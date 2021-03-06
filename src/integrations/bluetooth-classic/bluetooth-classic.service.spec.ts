const mockExec = jest.fn();

import { Test, TestingModule } from '@nestjs/testing';
import { BluetoothClassicService } from './bluetooth-classic.service';
import { ConfigModule } from '../../config/config.module';
import { EntitiesModule } from '../../entities/entities.module';
import { ClusterModule } from '../../cluster/cluster.module';
import { EntitiesService } from '../../entities/entities.service';
import { ClusterService } from '../../cluster/cluster.service';
import { ScheduleModule } from '@nestjs/schedule';
import {
  NEW_RSSI_CHANNEL,
  REQUEST_RSSI_CHANNEL
} from './bluetooth-classic.const';
import { NewRssiEvent } from './new-rssi.event';
import { RoomPresenceDistanceSensor } from '../room-presence/room-presence-distance.sensor';
import KalmanFilter from 'kalmanjs';
import { Switch } from '../../entities/switch';
import { BluetoothClassicConfig } from './bluetooth-classic.config';
import c from 'config';
import { ConfigService } from '../../config/config.service';
import { Device } from './device';

jest.mock('../room-presence/room-presence-distance.sensor');
jest.mock('kalmanjs', () => {
  return jest.fn().mockImplementation(() => {
    return {
      filter: (z: number): number => z
    };
  });
});
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  promisify: () => mockExec
}));
jest.useFakeTimers();

describe('BluetoothClassicService', () => {
  let service: BluetoothClassicService;
  const entitiesService = {
    add: jest.fn(),
    get: jest.fn(),
    has: jest.fn()
  };
  const clusterService = {
    on: jest.fn(),
    nodes: jest.fn(),
    send: jest.fn(),
    publish: jest.fn(),
    subscribe: jest.fn(),
    isMajorityLeader: jest.fn()
  };
  const loggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  };
  const config: Partial<BluetoothClassicConfig> = {
    addresses: ['8d:ad:e3:e2:7a:01', 'f7:6c:e3:10:55:b5'],
    hciDeviceId: 0,
    interval: 6,
    timeoutCycles: 2
  };
  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      return key === 'bluetoothClassic' ? config : c.get(key);
    })
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule,
        EntitiesModule,
        ClusterModule,
        ScheduleModule.forRoot()
      ],
      providers: [BluetoothClassicService]
    })
      .overrideProvider(EntitiesService)
      .useValue(entitiesService)
      .overrideProvider(ClusterService)
      .useValue(clusterService)
      .overrideProvider(ConfigService)
      .useValue(configService)
      .compile();
    module.useLogger(loggerService);

    service = module.get<BluetoothClassicService>(BluetoothClassicService);
  });

  it('should throw an error if hcitool is not installed', async () => {
    mockExec.mockRejectedValue({ stderr: 'hcitool not found' });

    await expect(service.onModuleInit()).rejects.toThrow();
  });

  it('should not throw an error if hcitool is found', async () => {
    mockExec.mockResolvedValue({ stdout: 'hcitool help' });

    await expect(service.onModuleInit()).resolves.not.toThrow();
  });

  it('should setup the cluster bindings on bootstrap', () => {
    entitiesService.add.mockReturnValue(
      new Switch('query-switch', 'Query Switch')
    );

    service.onApplicationBootstrap();

    expect(clusterService.on).toHaveBeenCalledWith(
      REQUEST_RSSI_CHANNEL,
      expect.anything()
    );
    expect(clusterService.on).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expect.anything()
    );
    expect(clusterService.subscribe).toHaveBeenCalledWith(NEW_RSSI_CHANNEL);
  });

  it('should create and register an inquiries switch on bootstrap', () => {
    const mockSwitch = new Switch('inquiries-switch', 'Inquiries Switch');
    entitiesService.add.mockReturnValue(mockSwitch);
    const turnOnSpy = jest.spyOn(mockSwitch, 'turnOn');

    service.onApplicationBootstrap();

    expect(entitiesService.add).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'bluetooth-classic-inquiries-switch',
        name: 'test-instance Bluetooth Inquiries'
      }),
      expect.any(Array)
    );
    expect(turnOnSpy).toHaveBeenCalled();
  });

  it('should return measured RSSI value from command output', () => {
    mockExec.mockResolvedValue({ stdout: 'RSSI return value: -4' });

    const address = '77:50:fb:4d:ab:70';

    expect(service.inquireRssi(address)).resolves.toBe(-4);
  });

  it('should return undefined if no RSSI could be determined', () => {
    mockExec.mockResolvedValue({
      stdout: "Can't create connection: Input/output error",
      stderr: 'Not connected.'
    });

    expect(service.inquireRssi('08:05:90:ed:3b:60')).resolves.toBeUndefined();
  });

  it('should return undefined if the command failed', () => {
    mockExec.mockRejectedValue({ message: 'Command failed' });

    expect(service.inquireRssi('08:05:90:ed:3b:60')).resolves.toBeUndefined();
  });

  it('should return reset the HCI device if the query took too long', async () => {
    mockExec.mockRejectedValue({ signal: 'SIGKILL' });

    const result = await service.inquireRssi('08:05:90:ed:3b:60');
    expect(result).toBeUndefined();
    expect(mockExec).toHaveBeenCalledWith('hciconfig hci0 reset');
  });

  it('should return device information based on parsed output', async () => {
    mockExec.mockResolvedValue({
      stdout: `
Requesting information ...
\tBD Address:  F0:99:B6:12:34:AB
\tOUI Company: Apple, Inc. (F0-99-B6)
\tDevice Name: Test iPhone
\tLMP Version: 5.0 (0x9) LMP Subversion: 0x4307
\tManufacturer: Broadcom Corporation (15)
\tFeatures page 0:
\tFeatures page 1:
\tFeatures page 2:
      `
    });

    expect(await service.inquireDeviceInfo('F0:99:B6:12:34:AB')).toStrictEqual({
      address: 'F0:99:B6:12:34:AB',
      name: 'Test iPhone',
      manufacturer: 'Apple, Inc.'
    });
  });

  it('should return the address as device name if none was found', async () => {
    mockExec.mockResolvedValue({
      stdout: 'IO error'
    });

    expect(await service.inquireDeviceInfo('F0:99:B6:12:34:AB')).toStrictEqual({
      address: 'F0:99:B6:12:34:AB',
      name: 'F0:99:B6:12:34:AB',
      manufacturer: undefined
    });
  });

  it('should return barebones information if request fails', async () => {
    mockExec.mockRejectedValue({ stderr: 'I/O Error' });

    expect(await service.inquireDeviceInfo('F0:99:B6:12:34:CD')).toStrictEqual({
      address: 'F0:99:B6:12:34:CD',
      name: 'F0:99:B6:12:34:CD'
    });
  });

  it('should publish the RSSI if found', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(0);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    const address = '77:50:fb:4d:ab:70';
    const device = new Device(address, 'Test Device');
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue(device);

    const expectedEvent = new NewRssiEvent('test-instance', device, 0);

    await service.handleRssiRequest(address);
    expect(clusterService.publish).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expectedEvent
    );
    expect(handleRssiMock).toHaveBeenCalledWith(expectedEvent);
  });

  it('should not publish an RSSI value if none was found', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(undefined);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);

    await service.handleRssiRequest('77:50:fb:4d:ab:70');

    expect(clusterService.publish).not.toHaveBeenCalled();
    expect(handleRssiMock).not.toHaveBeenCalled();
  });

  it('should publish RSSI values that are bigger than the min RSSI', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-9);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    config.minRssi = -10;

    await service.handleRssiRequest('77:50:fb:4d:ab:70');
    expect(handleRssiMock).toHaveBeenCalled();
    expect(clusterService.publish).toHaveBeenCalled();
  });

  it('should publish RSSI values that are the same as the min RSSI', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-10);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    config.minRssi = -10;

    await service.handleRssiRequest('77:50:fb:4d:ab:70');
    expect(handleRssiMock).toHaveBeenCalled();
    expect(clusterService.publish).toHaveBeenCalled();
  });

  it('should mark RSSI values that are smaller than the min RSSI as out of range', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-11);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    config.minRssi = -10;

    const address = '77:50:fb:4d:ab:70';
    const device = new Device(address, 'Test Device');
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue(device);

    const expectedEvent = new NewRssiEvent('test-instance', device, -11, true);

    await service.handleRssiRequest(address);
    expect(handleRssiMock).toHaveBeenCalledWith(expectedEvent);
    expect(clusterService.publish).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expectedEvent
    );
  });

  it('should handle minRssi per device', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-11);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    config.minRssi = {
      '77:50:fb:4d:ab:70': -10,
      default: -20
    };

    const address = '77:50:fb:4d:ab:70';
    const device = new Device(address, 'Test Device');
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue(device);

    const expectedEvent = new NewRssiEvent('test-instance', device, -11, true);

    await service.handleRssiRequest(address);
    expect(handleRssiMock).toHaveBeenCalledWith(expectedEvent);
    expect(clusterService.publish).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expectedEvent
    );
  });

  it('should pick the default minRssi if no device-specific one is configured', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-11);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    config.minRssi = {
      '77:50:fb:4d:ab:70': -10,
      default: -20
    };

    const address = '50:50:50:50:50:50';
    const device = new Device(address, 'Test Device');
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue(device);

    const expectedEvent = new NewRssiEvent('test-instance', device, -11, false);

    await service.handleRssiRequest(address);
    expect(handleRssiMock).toHaveBeenCalledWith(expectedEvent);
    expect(clusterService.publish).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expectedEvent
    );
  });

  it('should consider everything in range when no default minRssi is configured', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-25);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    config.minRssi = {
      '77:50:fb:4d:ab:70': -10
    };

    const address = '50:50:50:50:50:50';
    const device = new Device(address, 'Test Device');
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue(device);

    const expectedEvent = new NewRssiEvent('test-instance', device, -25, false);

    await service.handleRssiRequest(address);
    expect(handleRssiMock).toHaveBeenCalledWith(expectedEvent);
    expect(clusterService.publish).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expectedEvent
    );
  });

  it('should gather the device info for previously unkown addresses', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(0);
    jest.spyOn(service, 'handleNewRssi').mockImplementation(() => undefined);

    const address = '77:50:fb:4d:ab:70';
    const device = new Device(address, 'Test Device');
    const infoSpy = jest
      .spyOn(service, 'inquireDeviceInfo')
      .mockResolvedValue(device);

    await service.handleRssiRequest(address);

    expect(infoSpy).toHaveBeenCalledWith('77:50:fb:4d:ab:70');
  });

  it('should re-use already gathered device information', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(0);
    const handleSpy = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);

    const address = '77:50:fb:4d:ab:70';
    const device = new Device(address, 'Test Device');
    const infoSpy = jest
      .spyOn(service, 'inquireDeviceInfo')
      .mockResolvedValue(device);

    await service.handleRssiRequest(address);
    await service.handleRssiRequest(address);

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(handleSpy.mock.calls[1][0].device).toEqual(device);
  });

  it('should not trigger Bluetooth commands for undefined addresses', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    const inquireSpy = jest.spyOn(service, 'inquireRssi');

    await service.handleRssiRequest(undefined);
    expect(inquireSpy).not.toHaveBeenCalled();
  });

  it('should not trigger Bluetooth commands for empty addresses', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    const inquireSpy = jest.spyOn(service, 'inquireRssi');

    await service.handleRssiRequest('');
    expect(inquireSpy).not.toHaveBeenCalled();
  });

  it('should ignore RSSI requests of inquiries are disabled', () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(false);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);

    expect(clusterService.publish).not.toHaveBeenCalled();
    expect(handleRssiMock).not.toHaveBeenCalled();
  });

  it('should register a new sensor for a previously unknown device', async () => {
    entitiesService.has.mockReturnValue(false);
    entitiesService.add.mockImplementation(entity => entity);
    clusterService.nodes.mockReturnValue({
      abcd: { channels: [NEW_RSSI_CHANNEL] }
    });
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue({
      address: '10:36:cf:ca:9a:18',
      name: 'Test iPhone'
    });
    jest.useFakeTimers();

    const event = new NewRssiEvent(
      'test-instance',
      new Device('10:36:cf:ca:9a:18', 'Test Device'),
      -10
    );
    await service.handleNewRssi(event);

    expect(entitiesService.add).toHaveBeenCalledWith(
      expect.any(RoomPresenceDistanceSensor),
      expect.any(Array)
    );
    expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 6000);

    const sensorInstance = (RoomPresenceDistanceSensor as jest.Mock).mock
      .instances[0];
    expect(sensorInstance.handleNewDistance).toHaveBeenCalledWith(
      'test-instance',
      10,
      false
    );
    expect(sensorInstance.timeout).toBe(24);
  });

  it('should not distribute inquiries if not the leader', () => {
    clusterService.isMajorityLeader.mockReturnValue(false);
    const inquireSpy = jest.spyOn(service, 'inquireRssi');

    service.distributeInquiries();
    expect(clusterService.send).not.toHaveBeenCalled();
    expect(inquireSpy).not.toHaveBeenCalled();
  });

  it('should rotate inquiries correctly when there are more addresses than nodes', () => {
    clusterService.nodes.mockReturnValue({
      abcd: { channels: [NEW_RSSI_CHANNEL] }
    });
    clusterService.isMajorityLeader.mockReturnValue(true);
    const rssiRequestSpy = jest
      .spyOn(service, 'handleRssiRequest')
      .mockImplementation(() => undefined);

    service.distributeInquiries();
    expect(rssiRequestSpy).toHaveBeenLastCalledWith('8d:ad:e3:e2:7a:01');

    service.distributeInquiries();
    expect(rssiRequestSpy).toHaveBeenLastCalledWith('f7:6c:e3:10:55:b5');

    service.distributeInquiries();
    expect(rssiRequestSpy).toHaveBeenLastCalledWith('8d:ad:e3:e2:7a:01');
  });

  it('should rotate inquiries correctly when there are exactly as many addresses as nodes', () => {
    clusterService.nodes.mockReturnValue({
      abcd: { id: 'abcd', channels: [NEW_RSSI_CHANNEL] },
      def: { id: 'def', channels: [NEW_RSSI_CHANNEL], last: new Date() }
    });
    clusterService.isMajorityLeader.mockReturnValue(true);
    const handleRssiRequest = jest
      .spyOn(service, 'handleRssiRequest')
      .mockImplementation(() => undefined);

    service.distributeInquiries();
    expect(handleRssiRequest).toHaveBeenLastCalledWith('8d:ad:e3:e2:7a:01');
    expect(clusterService.send).toHaveBeenLastCalledWith(
      REQUEST_RSSI_CHANNEL,
      'f7:6c:e3:10:55:b5',
      'def'
    );

    service.distributeInquiries();
    expect(handleRssiRequest).toHaveBeenLastCalledWith('f7:6c:e3:10:55:b5');
    expect(clusterService.send).toHaveBeenLastCalledWith(
      REQUEST_RSSI_CHANNEL,
      '8d:ad:e3:e2:7a:01',
      'def'
    );

    service.distributeInquiries();
    expect(handleRssiRequest).toHaveBeenLastCalledWith('8d:ad:e3:e2:7a:01');
    expect(clusterService.send).toHaveBeenLastCalledWith(
      REQUEST_RSSI_CHANNEL,
      'f7:6c:e3:10:55:b5',
      'def'
    );
  });

  it('should rotate inquiries correctly when there are more nodes than addresses', () => {
    clusterService.nodes.mockReturnValue({
      abcd: { id: 'abcd', channels: [NEW_RSSI_CHANNEL] },
      def: { id: 'def', channels: [NEW_RSSI_CHANNEL], last: new Date() },
      xyz: { id: 'xyz', channels: [NEW_RSSI_CHANNEL], last: new Date() }
    });
    clusterService.isMajorityLeader.mockReturnValue(true);
    const handleRssiRequest = jest
      .spyOn(service, 'handleRssiRequest')
      .mockImplementation(() => undefined);

    service.distributeInquiries();
    expect(handleRssiRequest).toHaveBeenLastCalledWith('8d:ad:e3:e2:7a:01');
    expect(clusterService.send).toHaveBeenCalledWith(
      REQUEST_RSSI_CHANNEL,
      'f7:6c:e3:10:55:b5',
      'def'
    );
    expect(clusterService.send).toHaveBeenCalledTimes(1);
    handleRssiRequest.mockClear();
    clusterService.send.mockClear();

    service.distributeInquiries();
    expect(handleRssiRequest).not.toHaveBeenCalled();
    expect(clusterService.send).toHaveBeenCalledWith(
      REQUEST_RSSI_CHANNEL,
      '8d:ad:e3:e2:7a:01',
      'def'
    );
    expect(clusterService.send).toHaveBeenCalledWith(
      REQUEST_RSSI_CHANNEL,
      'f7:6c:e3:10:55:b5',
      'xyz'
    );
    expect(clusterService.send).toHaveBeenCalledTimes(2);
    handleRssiRequest.mockClear();
    clusterService.send.mockClear();

    service.distributeInquiries();
    expect(handleRssiRequest).toHaveBeenCalledWith('f7:6c:e3:10:55:b5');
    expect(clusterService.send).toHaveBeenCalledWith(
      REQUEST_RSSI_CHANNEL,
      '8d:ad:e3:e2:7a:01',
      'xyz'
    );
    expect(clusterService.send).toHaveBeenCalledTimes(1);
    handleRssiRequest.mockClear();
    clusterService.send.mockClear();

    service.distributeInquiries();
    expect(handleRssiRequest).toHaveBeenLastCalledWith('8d:ad:e3:e2:7a:01');
    expect(clusterService.send).toHaveBeenCalledWith(
      REQUEST_RSSI_CHANNEL,
      'f7:6c:e3:10:55:b5',
      'def'
    );
    expect(clusterService.send).toHaveBeenCalledTimes(1);
  });

  it('should only account for nodes that have the integration enabled', () => {
    clusterService.nodes.mockReturnValue({
      abcd: { id: 'abcd', channels: [NEW_RSSI_CHANNEL] },
      def: { id: 'def', channels: [NEW_RSSI_CHANNEL], last: new Date() },
      xyz: { id: 'xyz', last: new Date() }
    });

    const nodes = service.getParticipatingNodes();
    expect(nodes).toHaveLength(2);
    expect(nodes.find(node => node.id === 'abcd')).not.toBeUndefined();
    expect(nodes.find(node => node.id === 'def')).not.toBeUndefined();
    expect(nodes.find(node => node.id === 'xyz')).toBeUndefined();
  });

  it('should filter the RSSI of inquired devices before publishing', async () => {
    jest.spyOn(service, 'shouldInquire').mockReturnValue(true);
    jest.spyOn(service, 'inquireRssi').mockResolvedValue(-3);
    const handleRssiMock = jest
      .spyOn(service, 'handleNewRssi')
      .mockImplementation(() => undefined);
    const filterRssiMock = jest
      .spyOn(service, 'filterRssi')
      .mockReturnValue(-5.2);

    const address = 'ab:cd:01:23:00:70';
    const device = new Device(address, 'Test Device');
    jest.spyOn(service, 'inquireDeviceInfo').mockResolvedValue(device);

    const expectedEvent = new NewRssiEvent('test-instance', device, -5.2);

    await service.handleRssiRequest(address);
    expect(filterRssiMock).toHaveBeenCalled();
    expect(clusterService.publish).toHaveBeenCalledWith(
      NEW_RSSI_CHANNEL,
      expectedEvent
    );
    expect(handleRssiMock).toHaveBeenCalledWith(expectedEvent);
  });

  it('should reuse Kalman filters for the same address', () => {
    service.filterRssi('D6:AB:CD:10:DA:31', -1);
    service.filterRssi('D6:AB:CD:10:DA:41', -4);
    service.filterRssi('D6:AB:CD:10:DA:31', -2);

    expect(KalmanFilter).toHaveBeenCalledTimes(2);
  });

  it('should not allow inquiries if the inquiries switch is turned off', () => {
    const mockSwitch = new Switch('inquiries-switch', 'Inquiries Switch');
    entitiesService.add.mockReturnValue(mockSwitch);

    service.onApplicationBootstrap();
    mockSwitch.state = false;

    expect(service.shouldInquire()).toBeFalsy();
  });

  it('should allow inquiries if the inquiries switch is turned on', () => {
    const mockSwitch = new Switch('inquiries-switch', 'Inquiries Switch');
    entitiesService.add.mockReturnValue(mockSwitch);

    service.onApplicationBootstrap();
    mockSwitch.state = true;

    expect(service.shouldInquire()).toBeTruthy();
  });
});
