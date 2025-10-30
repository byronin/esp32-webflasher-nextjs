"use client";

import { useState } from "react";
import { ESPLoader } from "esptool-js";

// TypeScript global augmentation for Web Serial API
declare global {
  interface Navigator {
    serial: any;
  }
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState<string>("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [port, setPort] = useState<any | null>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [flashAddress, setFlashAddress] = useState<string>("0x1000");
  const [debugReader, setDebugReader] =
    useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  const appendLog = (msg: string) => setLog((prev) => prev + msg + "\n");

  const terminal = {
    clean() {
      setLog("");
    },
    writeLine(data: string) {
      setLog((prev) => prev + data + "\n");
    },
    write(data: string) {
      setLog((prev) => prev + data);
    },
  };

  const handleSelectPort = async () => {
    try {
      // Web Serial API'nin mevcut olduğunu kontrol et
      if (!navigator.serial) {
        throw new Error("Web Serial API not supported. Please use Chrome or Edge browser.");
      }
      
      const selectedPort = await navigator.serial.requestPort();
      
      // Port nesnesinin geçerli olduğunu kontrol et
      if (!selectedPort || typeof selectedPort.open !== 'function') {
        throw new Error("Invalid port selected");
      }
      
      setPort(selectedPort);
      appendLog("✅ Serial port selected.");
      appendLog(`📱 Port info: ${selectedPort.getInfo ? 'Available' : 'Basic port'}`);
    } catch (err) {
      if (err instanceof Error) {
        appendLog("❌ Port selection failed: " + err.message);
      }
    }
  };

  const handleDebugSerial = async () => {
    if (!port) {
      appendLog("⚠️ No serial port selected.");
      return;
    }
    try {
      // Port zaten açıksa kapat
      if (port.readable || port.writable) {
        await port.close();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      await port.open({ baudRate });
      
      // Port'un doğru şekilde açıldığını kontrol et
      if (!port.readable) {
        throw new Error("Port readable stream not available");
      }
      
      const textDecoder = new TextDecoderStream();
      void port.readable?.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      setDebugReader(reader);
      appendLog("🪵 Debug serial started...");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) appendLog("📥 " + value);
      }
    } catch (err) {
      if (err instanceof Error) {
        appendLog("❌ Debug error: " + err.message);
        // Port'u kapatmaya çalış
        try {
          await port.close();
        } catch {
          // Port kapatma hatası görmezden gel
        }
      }
    }
  };

  const stopDebugSerial = async () => {
    try {
      await debugReader?.cancel();
      await port?.close();
      setDebugReader(null);
      appendLog("🛑 Debug serial stopped.");
    } catch (err) {
      if (err instanceof Error) appendLog("❌ Stop error: " + err.message);
    }
  };

  const handleFlash = async () => {
    if (!file) {
      appendLog("⚠️ No file selected.");
      return;
    }

    if (!port) {
      appendLog("⚠️ No serial port selected.");
      return;
    }

    try {
      appendLog(`🔌 Opening serial port at ${baudRate} baud...`);
      
      // Port zaten açıksa kapat
      if (port.readable || port.writable) {
        await port.close();
        await new Promise(resolve => setTimeout(resolve, 500)); // Daha uzun bekleme
      }
      
      // Port'u yeniden aç
      await port.open({ baudRate });
      
      // Port'un tamamen hazır olmasını bekle
      await new Promise(resolve => setTimeout(resolve, 200));

      // Port'un doğru şekilde açıldığını kontrol et
      if (!port.readable || !port.writable) {
        throw new Error("Port could not be opened properly");
      }

      appendLog("🔍 Creating ESPLoader...");
      
      // Port nesnesinin tüm gerekli özelliklerini kontrol et
      if (!port || typeof port.open !== 'function' || !port.readable || !port.writable) {
        throw new Error("Invalid port object - missing required properties");
      }
      
      // ESPLoader için port'u hazırla - daha güvenli yaklaşım
      let loader;
      try {
        // Port nesnesini ESPLoader için hazırla - getInfo sorununu çöz
        const preparedPort = {
          // Tüm port özelliklerini kopyala
          ...port,
          // getInfo fonksiyonunu güvenli hale getir
          getInfo: function() {
            try {
              // Orijinal getInfo varsa kullan
              if (port.getInfo && typeof port.getInfo === 'function') {
                return port.getInfo();
              }
            } catch {
              // getInfo hatası varsa fallback kullan
            }
            // Fallback bilgileri
            return {
              usbVendorId: 0x10C4,
              usbProductId: 0xEA60,
              serialNumber: 'ESP32',
              manufacturerName: 'Silicon Labs',
              productName: 'CP210x USB to UART Bridge'
            };
          },
          // Diğer gerekli özellikleri kopyala
          open: port.open.bind(port),
          close: port.close.bind(port),
          readable: port.readable,
          writable: port.writable
        };
        
        // Port nesnesinin tüm özelliklerini kontrol et
        appendLog(`🔍 Port properties: ${Object.keys(preparedPort).join(', ')}`);
        appendLog(`🔍 getInfo type: ${typeof preparedPort.getInfo}`);
        appendLog(`🔍 getInfo result: ${JSON.stringify(preparedPort.getInfo())}`);
        
        appendLog("🔧 Port wrapper created successfully");
        
        // ESPLoader'ı daha güvenli şekilde oluştur
        try {
          loader = new ESPLoader(preparedPort, baudRate, terminal);
          appendLog("✅ ESPLoader created successfully");
        } catch (esploaderError) {
          appendLog(`❌ ESPLoader creation error: ${esploaderError.message}`);
          // Alternatif yaklaşım - port nesnesini daha basit hale getir
          const simplePort = {
            open: port.open.bind(port),
            close: port.close.bind(port),
            readable: port.readable,
            writable: port.writable,
            getInfo: () => ({
              usbVendorId: 0x10C4,
              usbProductId: 0xEA60,
              serialNumber: 'ESP32'
            })
          };
          appendLog("🔄 Trying with simplified port...");
          try {
            loader = new ESPLoader(simplePort, baudRate, terminal);
            appendLog("✅ ESPLoader created with simplified port");
          } catch (simpleError) {
            appendLog(`❌ Simplified port error: ${simpleError.message}`);
            // Son çare - port nesnesini tamamen yeniden oluştur
            const minimalPort = {
              open: port.open.bind(port),
              close: port.close.bind(port),
              readable: port.readable,
              writable: port.writable,
              getInfo: function() {
                return {
                  usbVendorId: 0x10C4,
                  usbProductId: 0xEA60,
                  serialNumber: 'ESP32'
                };
              }
            };
            appendLog("🔄 Trying with minimal port...");
            loader = new ESPLoader(minimalPort, baudRate, terminal);
            appendLog("✅ ESPLoader created with minimal port");
          }
        }
      } catch (loaderError) {
        appendLog(`❌ ESPLoader error details: ${loaderError.message}`);
        throw new Error(`ESPLoader creation failed: ${loaderError.message}`);
      }

      appendLog("🔍 Syncing with ESP...");
      await loader.sync();

      appendLog("💥 Erasing flash...");
      await loader.eraseFlash();

      const buffer = await file.arrayBuffer();
      const binData = new Uint8Array(buffer);

      appendLog("🚀 Flashing firmware...");
      const address = parseInt(flashAddress, 16);
      appendLog(`📍 Flash address: ${flashAddress} (${address})`);
      await loader.flash([{ data: binData, address: address }]);

      appendLog("✅ Flash complete!");
      await port.close();
    } catch (err) {
      if (err instanceof Error) {
        appendLog("❌ Error: " + err.message);
        // Port'u kapatmaya çalış
        try {
          await port.close();
        } catch {
          // Port kapatma hatası görmezden gel
        }
      }
    }
  };

  return (
    <div className="mt-10 border border-gray-200 max-w-2xl mx-auto p-6 bg-white shadow-xl rounded-xl">
      <h1 className="text-3xl font-bold mb-6 text-center text-blue-700">
        ESP32 Web Flasher
      </h1>

      <div className="w-full gap-2 flex mb-2">
        <button
          onClick={handleSelectPort}
          className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800 w-full"
        >
          🔌 Select Serial Port
        </button>
        <select
          value={baudRate}
          onChange={(e) => setBaudRate(Number(e.target.value))}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          {[9600, 57600, 115200, 230400, 460800, 921600].map((rate) => (
            <option key={rate} value={rate}>
              {rate} baud
            </option>
          ))}
        </select>
      </div>
      
      <div className="w-full gap-2 flex mb-2">
        <label className="text-sm font-medium text-gray-700">Flash Address:</label>
        <select
          value={flashAddress}
          onChange={(e) => setFlashAddress(e.target.value)}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="0x1000">0x1000 - Bootloader (Arduino)</option>
          <option value="0x0">0x0 - Bootloader (Alternative)</option>
          <option value="0x10000">0x10000 - Partition Table</option>
          <option value="0x20000">0x20000 - Application (ESP-IDF)</option>
        </select>
      </div>
      <div className="flex flex-col md:flex-row items-center gap-4 mb-4 w-full">
        <div className="p-2 border border-gray-300 rounded w-full">
          <p>Select a firmware file to flash:</p>
          <input
            type="file"
            accept=".bin"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="border border-gray-300 rounded px-3 py-2 w-full"
          />
        </div>
      </div>

      <div className="flex gap-4 mb-4">
        <button
          onClick={handleFlash}
          disabled={!file || !port}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          🚀 Flash Firmware
        </button>
        <button
          onClick={handleDebugSerial}
          disabled={!port || debugReader !== null}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
        >
          🐞 Start Debug
        </button>
        <button
          onClick={stopDebugSerial}
          disabled={!debugReader}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          🛑 Stop Debug
        </button>
      </div>

      <pre className="bg-black text-green-400 p-4 h-64 overflow-auto text-sm rounded font-mono">
        {log}
      </pre>
    </div>
  );
}