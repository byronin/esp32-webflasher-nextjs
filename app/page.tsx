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
      if (!navigator.serial) {
        throw new Error("Web Serial API not supported. Please use Chrome or Edge browser.");
      }
      const selectedPort = await navigator.serial.requestPort();
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
      if (port.readable || port.writable) {
        await port.close();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      await port.open({ baudRate });
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
        try {
          await port.close();
        } catch {}
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
      if (port.readable || port.writable) {
        await port.close();
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      await port.open({ baudRate });
      await new Promise(resolve => setTimeout(resolve, 150));

      appendLog("🔍 Creating ESPLoader...");
      // Pass raw Web Serial port directly; ESPLoader will wrap with Transport
      const loader = new ESPLoader({ port, baudrate: baudRate, terminal });
      appendLog("✅ ESPLoader created successfully");

      // Follow official flow: connect/detect + optional stub + change baud
      appendLog("🔗 Connecting to chip...");
      await loader.main("default_reset");

      // Prepare firmware
      const buffer = await file.arrayBuffer();
      const binData = new Uint8Array(buffer);
      const address = parseInt(flashAddress, 16);
      appendLog(`📍 Flash address: ${flashAddress} (${address})`);

      appendLog("💥 Erasing + flashing (compressed)...");
      await loader.writeFlash({
        fileArray: [{ data: binData, address }],
        flashSize: "keep",
        flashMode: "keep",
        flashFreq: "keep",
        compress: true,
        reportProgress: (_i, sent, total) => {
          const pct = total > 0 ? Math.floor((sent / total) * 100) : 0;
          appendLog(`➡️ ${pct}%`);
        },
      });

      appendLog("✅ Flash complete!");
      await port.close();
    } catch (err) {
      if (err instanceof Error) {
        appendLog("❌ Error: " + err.message);
        try {
          await port.close();
        } catch {}
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
          <option value="0x10000">0x10000 - App (common)</option>
          <option value="0x20000">0x20000 - App (ESP-IDF)</option>
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