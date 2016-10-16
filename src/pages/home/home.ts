import { Component, NgZone } from '@angular/core';
import { NavController } from 'ionic-angular';

declare var bluetoothle;

enum BulbMode {
  RGB,
  WHITE,
  PRESET
}

const DEVICE_VERSION = 0x8;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  private mode: BulbMode = BulbMode.WHITE;

  // Parameters for WHITE mode
  private whiteValue: number = 0xff;

  // Parameters for RGB mode
  private redValue: number;
  private greenValue: number;
  private blueValue: number;

  // Parameters for PRESET mode
  presetNumber: number; // 0x25 to 0x38
  presetSpeed: number; // each unit is about 200ms

  on: boolean = false;

  constructor(public navCtrl: NavController, private zone: NgZone) {
    document.addEventListener('deviceready', () => {
      if (typeof bluetoothle !== 'undefined') {
        bluetoothle.initialize(result => this.onBleReady(result), {
          request: true
        });
      }
    }, false);
  }

  get color() {
    switch (this.mode) {
      case BulbMode.RGB:
        return `rgb(${this.redValue},${this.greenValue},${this.blueValue})`;

      case BulbMode.WHITE:
        return `rgb(${this.whiteValue},${this.whiteValue},0)`;
    }
  }

  onBleReady(result) {
    console.log('onBleReady', result);
    bluetoothle.initializePeripheral(status => this.bleCallback(status), err => this.onError(err), {
      request: true
    });
  }

  bleCallback(event) {
    console.log('BLE callback', event);
    if (event.status === 'enabled') {
      bluetoothle.addService(result => console.log('ok', result), err => console.log('failed!', err), {
        service: 'ffe5',
        characteristics: [
          {
            uuid: 'ffe9',
            permissions: {
              write: true
            },
            properties: {
              writeNoResponse: true,
              writeWithoutResponse: true
            }
          }
        ]
      });

      bluetoothle.addService(result => console.log('ok', result), err => console.log('failed!', err), {
        service: 'ffe0',
        characteristics: [
          {
            uuid: 'ffe4',
            permissions: {
              read: true
            },
            properties: {
              notify: true
            }
          }
        ]
      });

      bluetoothle.startAdvertising(result => console.log('advertising', result), err => console.error('advertising failed', err), {
        services: ['ffe5'],
        service: 'ffe5',
        name: 'LEDBLE-SIM',
        mode: 'lowLatency',
        connectable: true,
        timeout: 500,
        powerLevel: 'high'
      });
    }
    if (event.status === 'writeRequested' && event.characteristic.toLowerCase() === 'ffe9') {
      this.onWrite(atob(event.value), event.address);
      bluetoothle.respond(result => console.log('respond', result), err => console.error('respond', err), {
        requestId: event.requestId,
        value: event.value,
        address: event.address
      });
    }
  }

  private bulbStateBytes() {
    switch (this.mode) {
      case BulbMode.RGB:
        return [0x66, 0x15, 0x23, 0x4A, 0x41, 0x02, this.redValue, this.greenValue, this.blueValue, 0x00, DEVICE_VERSION, 0x99];

      case BulbMode.WHITE:
        return [0x66, 0x15, 0x23, 0x4B, 0x41, 0x02, 0x00, 0x00, 0x00, this.whiteValue, DEVICE_VERSION, 0x99];

      case BulbMode.PRESET:
        return [0x66, 0x15, 0x23, this.presetNumber, 0x41, this.presetSpeed, 0x00, 0x00, 0x00, 0x00, DEVICE_VERSION, 0x99];

      default:
        return [0];
    }
  }

  onWrite(value: string, address: string) {
    if ((value.charCodeAt(0) === 0x56 || value.charCodeAt(0) === 0x78) && value.length === 7) {
      if (value.charCodeAt(5) === 0xf0) {
        this.zone.run(() => {
          this.mode = BulbMode.RGB;
          this.redValue = value.charCodeAt(1);
          this.greenValue = value.charCodeAt(2);
          this.blueValue = value.charCodeAt(3);
          this.presetNumber = null;
          this.on = true;
        });
      } else if (value.charCodeAt(5) == 0x0f) {
        this.zone.run(() => {
          this.mode = BulbMode.WHITE;
          this.whiteValue = value.charCodeAt(4);
          this.presetNumber = null;
          this.on = true;
        });
      }
    }
    if (value.charCodeAt(0) === 0xbb && value.charCodeAt(3) === 0x44 && value.length === 4) {
      this.zone.run(() => {
        this.mode = BulbMode.PRESET;
        this.presetNumber = value.charCodeAt(1);
        this.presetSpeed = value.charCodeAt(2);
      });
    }
    if (value.charCodeAt(0) === 0xef && value.charCodeAt(1) === 0x01 && value.charCodeAt(2) === 0x77) {
      // Read current state command
      console.log('Read current state');
      bluetoothle.notify(
        result => console.log('notify result', result),
        error => console.error('notify failed', error), {
          address,
          service: "ffe0",
          characteristic: "ffe4",
          value: bluetoothle.bytesToEncodedString(this.bulbStateBytes())
        });
    }
    if (value.charCodeAt(0) === 0x12) {
      // 12 1a 1b 21 - Read current time command
      console.log('Read current Time');
      bluetoothle.notify(
        result => console.log('notify result', result),
        error => console.error('notify failed', error), {
          address,
          service: "ffe0",
          characteristic: "ffe4",
          value: bluetoothle.bytesToEncodedString([0x13, 0x14, 0x00, 0x01, 0x01, 0x00, 0x00, 0x12, 0x01, 0x00, 0x31])
        });
    }
  }

  onError(err) {
    console.log('BLE error', err);
  }
}
