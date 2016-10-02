import { Component, NgZone } from '@angular/core';
import { NavController } from 'ionic-angular';

declare var bluetoothle;

@Component({
  selector: 'page-home',
  templateUrl: 'home.html'
})
export class HomePage {
  color: string = 'rgb(0,0,0)';
  on: boolean = false;

  constructor(public navCtrl: NavController, private zone: NgZone) {
    document.addEventListener('deviceready', () => {
      if (typeof bluetoothle !== 'undefined') {
        bluetoothle.initialize(result => this.onBleReady(result), {
          request: true,
          restoreKey: 'magicblue-simulator'
        });
      }
    }, false);
  }

  onBleReady(result) {
    console.log('onBleReady', result);
    bluetoothle.initializePeripheral(status => this.bleCallback(status), err => this.onError(err), {
      request: true,
      restoreKey: 'magicblue-simulator'
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
              writeNoResponse: true
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
        name: 'Hello World',
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

  onWrite(value: string, address: string) {
    if (value.charCodeAt(0) === 0x56 && value.length === 7) {
      if (value.charCodeAt(5) === 0xf0) {
        // RGB Mode
        const redValue = value.charCodeAt(1);
        const greenValue = value.charCodeAt(2);
        const blueValue = value.charCodeAt(3);
        this.zone.run(() => {
          this.on = true;
          this.color = `rgb(${redValue},${greenValue},${blueValue})`;
        });
      } else {
        // TODO Warm white mode
      }
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
          value: bluetoothle.bytesToEncodedString([0x66, 0x15, 0x23, 0x4A, 0x41, 0x02, 0xFF, 0x00, 0x00, 0x00, 0x08, 0x99])
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
