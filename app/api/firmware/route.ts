import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { Tools } from '@/utils/api/Tools'
import dotenv from 'dotenv';
dotenv.config();

export const GET = async () => {
  let firmwareDir = process.env.FIRMWARE_DIR || 'public/firmware';
  if (firmwareDir.startsWith('~')) {
    firmwareDir = path.join(os.homedir(), firmwareDir.slice(1));
  }

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
    const filePath = path.resolve('public', 'firmware', fileName)
    try {
        const fileBuffer = fs.readFileSync(filePath)
        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}.bin"`,
            },
        })
    } catch (error) {
        console.log(error)
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
}
