import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { config } from "../config";
import { AppError } from "../middleware/errorHandler";
import { RegisterInput, LoginInput } from "../validation/auth.schemas";

function generateToken(userId: string, email: string, name: string): string {
  return jwt.sign({ id: userId, email, name }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"],
  });
}

export async function registerUser(input: RegisterInput) {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw new AppError(409, "Email already registered");
  }

  const hashedPassword = await bcrypt.hash(input.password, config.bcryptRounds);
  const user = await User.create({
    name: input.name,
    email: input.email,
    password: hashedPassword,
  });

  const token = generateToken(user._id.toString(), user.email, user.name);
  return {
    token,
    user,
  };
}

export async function loginUser(input: LoginInput) {
  const user = await User.findOne({ email: input.email });
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(input.password, user.password);
  if (!passwordMatch) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = generateToken(user._id.toString(), user.email, user.name);
  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  };
}

export async function getMe(userId: string) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(404, "User not found");
  }
  return {
    user,
  };
}
