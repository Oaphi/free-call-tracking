type AsyncOptions = {
    funcName: string;
    onEnd?: () => void;
    onFailure?: (err: Error) => unknown;
    onSuccess?: (data: unknown) => unknown;
    params?: google.script.Parameter[];
};

/**
 * @summary v2 of async-friendly google.script.run
 */
const run = ({
    funcName,
    onEnd,
    onFailure = console.error,
    onSuccess,
    params = [],
}: AsyncOptions): Promise<any> => {
    return new Promise((res, rej) => {
        google.script.run
            .withSuccessHandler((data) => {
                typeof onSuccess === "function" && onSuccess(data);
                typeof onEnd === "function" && onEnd();
                res(data);
            })
            .withFailureHandler((error) => {
                typeof onFailure === "function" && onFailure(error);
                typeof onEnd === "function" && onEnd();
                rej(error);
            })
            [funcName].apply(null, params);
    });
};

/**
 * @summary mini-version of the above
 */
const gscript = (
    funcName: string,
    ...params: google.script.Parameter[]
): Promise<any> => {
    return new Promise((res, rej) => {
        google.script.run
            .withSuccessHandler(res)
            .withFailureHandler(rej)
            [funcName].apply(null, params);
    });
};
