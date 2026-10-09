import { Schema, model, Document, Types } from 'mongoose';
import { TaskPriority, TaskStatus } from '../types';

export interface ITask extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: Types.ObjectId;
  createdBy: Types.ObjectId;
  assigneeId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    status: {
      type: String,
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true },
);

taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ projectId: 1, priority: 1 });
taskSchema.index({ assigneeId: 1 });
taskSchema.index({ createdBy: 1 });

export const Task = model<ITask>('Task', taskSchema);
