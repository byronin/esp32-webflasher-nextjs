import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { Tools } from '@/utils/api/Tools'

export const GET = async () => {
    const firmwareDir = path.resolve('public/firmware')
    const allFiles = fs.readdirSync(firmwareDir).filter(file => {
        const ext = path.extname(file)
        return ext === '.bin' || ext === '.hex'
    })
    return NextResponse.json(Tools.res(allFiles))
}

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
