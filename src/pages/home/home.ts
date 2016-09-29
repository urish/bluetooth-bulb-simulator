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
      this.onWrite(atob(event.value));
      bluetoothle.respond(result => console.log('respond', result), err => console.error('respond', err), {
        requestId: event.requestId,
        value: event.value,
        address: event.address
      });
    }
  }

  onWrite(value: string) {
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
  }

  onError(err) {
    console.log('BLE error', err);
  }
}
