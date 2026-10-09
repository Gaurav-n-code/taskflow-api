import { Schema, model, Document, Types } from 'mongoose';

export interface IProject extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  owner: Types.ObjectId;
  members: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true },
);

projectSchema.index({ owner: 1 });
projectSchema.index({ members: 1 });

export const Project = model<IProject>('Project', projectSchema);
