/**
 * WebUSB uchun minimal ambient tiplar — TypeScript 5.9 `lib.dom` da WebUSB yoʻq
 * (https://wicg.github.io/webusb/). Faqat ESC/POS printerlar uchun kerakli qismi.
 * Global skript fayli (import/export yoʻq) — `tsconfig` "**\/*.ts" orqali avtomatik yuklanadi.
 */

type USBDirection = 'in' | 'out';
type USBEndpointType = 'bulk' | 'interrupt' | 'isochronous';
type USBTransferStatus = 'ok' | 'stall' | 'babble';

interface USBEndpoint {
  readonly endpointNumber: number;
  readonly direction: USBDirection;
  readonly type: USBEndpointType;
  readonly packetSize: number;
}

interface USBAlternateInterface {
  readonly alternateSetting: number;
  readonly interfaceClass: number;
  readonly interfaceSubclass: number;
  readonly interfaceProtocol: number;
  readonly interfaceName?: string;
  readonly endpoints: ReadonlyArray<USBEndpoint>;
}

interface USBInterface {
  readonly interfaceNumber: number;
  readonly alternate: USBAlternateInterface;
  readonly alternates: ReadonlyArray<USBAlternateInterface>;
  readonly claimed: boolean;
}

interface USBConfiguration {
  readonly configurationValue: number;
  readonly configurationName?: string;
  readonly interfaces: ReadonlyArray<USBInterface>;
}

interface USBOutTransferResult {
  readonly bytesWritten: number;
  readonly status: USBTransferStatus;
}

interface USBDevice {
  readonly vendorId: number;
  readonly productId: number;
  readonly productName?: string;
  readonly manufacturerName?: string;
  readonly serialNumber?: string;
  readonly opened: boolean;
  readonly configuration: USBConfiguration | null;
  readonly configurations: ReadonlyArray<USBConfiguration>;
  open(): Promise<void>;
  close(): Promise<void>;
  forget(): Promise<void>;
  reset(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  selectAlternateInterface(interfaceNumber: number, alternateSetting: number): Promise<void>;
  /** `ArrayBufferView` (TS 5.9 da `Uint8Array<ArrayBufferLike>` `BufferSource` ga mos kelmaydi — shuning uchun keng tip) */
  transferOut(endpointNumber: number, data: ArrayBuffer | ArrayBufferView): Promise<USBOutTransferResult>;
}

interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBConnectionEvent extends Event {
  readonly device: USBDevice;
}

interface USB extends EventTarget {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  addEventListener(type: 'connect' | 'disconnect', listener: (ev: USBConnectionEvent) => void): void;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void;
  removeEventListener(type: 'connect' | 'disconnect', listener: (ev: USBConnectionEvent) => void): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void;
}

interface Navigator {
  /** Chrome/Edge/Opera; Firefox va Safari da yoʻq */
  readonly usb?: USB;
}
