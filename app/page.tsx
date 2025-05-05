"use client";

import { useEffect, useState } from "react";
import { ESPLoader } from "esptool-js";

declare global {
  interface Navigator {
    serial: any;
  }
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileNames, setFileNamess] = useState([""]);
  const [log, setLog] = useState<string>("");
  const [port, setPort] = useState<SerialPort | null>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [debugReader, setDebugReader] =
    useState<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const [binData, setBinData] = useState<Uint8Array | null>(null);

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
      const selectedPort = await navigator.serial.requestPort();
      setPort(selectedPort);
      appendLog("✅ Serial port selected.");
    } catch (err) {
      if (err instanceof Error)
        appendLog("❌ Port selection failed: " + err.message);
    }
  };

  const headleLoadListFile = async () => {
    try {
      const res = await fetch("/api/firmware");
      if (!res.ok) throw new Error("Failed to fetch firmware list");
      const { data } = await res.json();
      appendLog("📜 Firmware list loaded:");
      data.forEach((item: string, index: number) => {
        appendLog(`${index + 1}: ${item}`);
      });
      setFileNamess(data);
    } catch (err) {
      if (err instanceof Error) appendLog("❌ List load error: " + err.message);
    }
  };

  const handleLoadFromAPI = async () => {
    try {
      appendLog("🌐 Fetching firmware from API...");
      const res = await fetch("/api/firmware", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileName }),
      });
      if (!res.ok) throw new Error("Failed to fetch firmware");
      const arrayBuffer = await res.arrayBuffer();
      const firmware = new Uint8Array(arrayBuffer);
      setBinData(firmware);
      setFile(null);
      const sizeInMB = (firmware.length / (1024 * 1024)).toFixed(2);
      appendLog(`📦 Firmware loaded from API (${sizeInMB} MB)`);
    } catch (err) {
      if (err instanceof Error) appendLog("❌ API load error: " + err.message);
    }
  };

  const handleLoadFromFile = async (f: File) => {
    try {
      appendLog(`📁 Reading file: ${f.name}`);
      const buffer = await f.arrayBuffer();
      const firmware = new Uint8Array(buffer);
      setBinData(firmware);
      setFile(f);
      const sizeInMB = (firmware.length / (1024 * 1024)).toFixed(2);
      appendLog(`📦 Firmware loaded from API (${sizeInMB} MB)`);
    } catch (err) {
      if (err instanceof Error) appendLog("❌ File load error: " + err.message);
    }
  };

  const handleDebugSerial = async () => {
    if (!port) {
      appendLog("⚠️ No serial port selected.");
      return;
    }
    try {
      await port.open({ baudRate });
      const textDecoder = new TextDecoderStream();
      const readableStreamClosed = port.readable?.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      setDebugReader(reader);
      appendLog("🪵 Debug serial started...");

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) appendLog("📥 " + value);
      }
    } catch (err) {
      if (err instanceof Error) appendLog("❌ Debug error: " + err.message);
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
    if (!binData) {
      appendLog("⚠️ No firmware loaded.");
      return;
    }

    if (!port) {
      appendLog("⚠️ No serial port selected.");
      return;
    }

    try {
      appendLog(`🔌 Opening serial port at ${baudRate} baud...`);
      await port.open({ baudRate });

      const loader = new ESPLoader(port, false, terminal);

      appendLog("🔍 Syncing with ESP...");
      await loader.sync();

      appendLog("💥 Erasing flash...");
      await loader.eraseFlash();

      appendLog("🚀 Flashing firmware...");
      await loader.flash([{ data: binData, address: 0x1000 }]);
      appendLog("✅ Flash complete!");
      await port.close();
    } catch (err) {
      if (err instanceof Error) appendLog("❌ Error: " + err.message);
    }
  };

  useEffect(() => {
    const load = async () => {
      await headleLoadListFile();
    };
    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white shadow-xl rounded-xl">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-700">
          ESP32 Web Flasher
        </h1>
      <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
        <button
          onClick={handleSelectPort}
          className="bg-gray-700 text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          🔌 Select Serial Port
        </button>
        <select
          value={baudRate}
          onChange={(e) => setBaudRate(Number(e.target.value))}
          className="border border-gray-300 rounded px-3 py-2"
        >
          {[9600, 57600, 115200, 230400, 460800, 921600].map((rate) => (
            <option key={rate} value={rate}>
              {rate} baud
            </option>
          ))}
        </select>

        <select
          name="listFileNames"
          className="border border-gray-300 rounded px-3 py-2"
          onChange={(e) => {
            const selected = e.target.value;
            const selectedFile = fileNames.find((item) => item === selected);
            setFileName(selectedFile || "");

            console.log("Selected:", selectedFile);
          }}
        >
          <option value={"--- Select firmware ---"} key={0}>
            {"--- Select firmware ---"}
          </option>
          {fileNames.map((item, index) => (
            <option key={index + 1} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          onClick={handleLoadFromAPI}
          className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700"
        >
          🌐 Load from API
        </button>
      </div>

      <div className="flex flex-col items-start gap-2 mb-4">
        <label htmlFor="file-input" className="text-gray-700 font-medium">
          Select a firmware file:
        </label>
        <input
          id="file-input"
          type="file"
          accept=".bin"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) handleLoadFromFile(selected);
          }}
          className="border border-gray-300 rounded px-3 py-2 w-full"
        />
      </div>

      <div className="flex gap-4 mb-4">
        <button
          onClick={handleFlash}
          disabled={!binData || !port}
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
