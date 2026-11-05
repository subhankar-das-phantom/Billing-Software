declare module 'jsonwebtoken' {
  export interface SignOptions {
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    algorithm?: string;
    header?: object;
    encoding?: string;
    issuer?: string;
    subject?: string;
    jwtid?: string;
    noTimestamp?: boolean;
    keyid?: string;
    mutatePayload?: boolean;
  }

  export interface VerifyOptions {
    algorithms?: string[];
    audience?: string | RegExp | Array<string | RegExp>;
    clockTimestamp?: number;
    clockTolerance?: number;
    complete?: boolean;
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    jwtid?: string;
    nonce?: string;
    subject?: string;
    maxAge?: string;
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions
  ): any;

  export function decode(
    token: string,
    options?: { json?: boolean; complete?: boolean }
  ): any;

  export class JsonWebTokenError extends Error {
    inner?: Error;
  }

  export class TokenExpiredError extends JsonWebTokenError {
    expiredAt: Date;
  }

  export class NotBeforeError extends JsonWebTokenError {
    date: Date;
  }

  const jwt: {
    sign: typeof sign;
    verify: typeof verify;
    decode: typeof decode;
    JsonWebTokenError: typeof JsonWebTokenError;
    TokenExpiredError: typeof TokenExpiredError;
    NotBeforeError: typeof NotBeforeError;
  };

  export default jwt;
}
