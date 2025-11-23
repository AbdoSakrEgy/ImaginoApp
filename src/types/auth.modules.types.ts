import { NextFunction, Request, Response } from "express";

export interface IAuthServcies {
  register(req: Request, res: Response, next: NextFunction): Promise<Response>;
  login(req: Request, res: Response, next: NextFunction): Promise<Response>;
  refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  confirmEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  updateEmail(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  resendEmailOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  updatePassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  forgetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  changePassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<Response>;
  logout(req: Request, res: Response, next: NextFunction): Promise<Response>;
}
