

export class Tools {
    /**
     * Formats a response object suitable for API Gateway with the given data
     * @param data the data to include in the response
     * @throws Error if data is null or undefined
     * @returns a response object with the given data and a timestamp
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static res(data: any) {
        if (data === null || data === undefined) {
            throw new Error('Data cannot be null or undefined');
        }

        return {
            timestamp: new Date(),
            data
        };
    }
}
