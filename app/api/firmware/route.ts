import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Tools } from '@/utils/api/Tools'
import dotenv from 'dotenv';
dotenv.config();

export const GET = async () => {
  const path = require('path');
  const os = require('os');

  let firmwareDir = process.env.FIRMWARE_DIR || 'public/firmware';

  if (firmwareDir.startsWith('~')) { // for Unix-like systems
    firmwareDir = path.join(os.homedir(), firmwareDir.slice(1));
  } else if (firmwareDir.match(/^%\w+%/)) { // for Windows-style environment variables
    const envVar = firmwareDir.match(/^%(\w+)%/)[1];
    const envValue = process.env[envVar];

    if (envValue) {
      firmwareDir = firmwareDir.replace(/^%\w+%/, envValue);
    }
  }

  firmwareDir = path.normalize(firmwareDir);

  firmwareDir = path.resolve(firmwareDir);
  if (!fs.existsSync(firmwareDir)) {
    return NextResponse.json({ error: `Firmware directory not found: ${firmwareDir}` }, { status: 404 });
  }

  const allFiles = fs.readdirSync(firmwareDir).filter(file => {
    const ext = path.extname(file);
    return ext === '.bin' || ext === '.hex';
  });

  return NextResponse.json(Tools.res(allFiles));
};

export const POST = async (req: NextRequest) => {
  const { fileName } = await req.json()
  if (!fileName) {
    return NextResponse.json({ error: 'File name is required' }, { status: 400 })
  }

  const sanitizedFileName = path.basename(fileName)
  
  let firmwareDir = process.env.FIRMWARE_DIR || path.join('public', 'firmware')
  
  if (firmwareDir.startsWith('~')) {
    firmwareDir = path.join(os.homedir(), firmwareDir.slice(1))
  } 
  else if (firmwareDir.match(/^%\w+%/)) {
    const envVar = firmwareDir.match(/^%(\w+)%/)[1]
    const envValue = process.env[envVar]
    
    if (envValue) {
      firmwareDir = firmwareDir.replace(/^%\w+%/, envValue)
    }
  }
  
  const possiblePaths = [
    path.resolve('public', 'firmware', sanitizedFileName),
    path.resolve(firmwareDir, sanitizedFileName),
    path.resolve(firmwareDir, sanitizedFileName + (sanitizedFileName.endsWith('.bin') ? '' : '.bin'))
  ]
  
  // possiblePaths.forEach(p => console.log(` - ${p}`))
  
  let fileBuffer = null
  let filePath = null
  
  for (const path of possiblePaths) {
    try {
      fileBuffer = fs.readFileSync(path)
      filePath = path
      break
    } catch (err) {
    }
  }
  
  if (fileBuffer) {
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${sanitizedFileName}"`,
      },
    })
  } else {
    return NextResponse.json({ 
      error: 'File not found',
      checkedPaths: possiblePaths
    }, { status: 404 })
  }
}