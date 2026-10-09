import mongoose from 'mongoose';
import { config } from './index';

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect("mongodb+srv://codzee:kjsehh32323#2323@cluster0.mongodb.net/taskflow?retryWrites=true&w=majority");
    console.info(`[Database] Connected to MongoDB`);
  } catch (error) {
    console.error('[Database] Connection failed:', error);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.info('[Database] Disconnected from MongoDB');
}
