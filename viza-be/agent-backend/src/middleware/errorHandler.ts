import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors.js";

export const errorHandler = (
	err: Error,
	req: Request,
	res: Response,
	_next: NextFunction
) => {
	if (err instanceof AppError) {
		return res.status(err.statusCode).json({
			success: false,
			error: err.message,
		});
	}

	console.error("Unhandled Error:", err);

	return res.status(500).json({
		success: false,
		error: "Internal Server Error",
	});
};
