import { Types } from 'mongoose';
import { Project } from '../models/Project';
import { User } from '../models/User';
import { AppError } from '../middleware/errorHandler';
import { CreateProjectInput, AddMemberInput } from '../validation/project.schemas';

export async function createProject(ownerId: string, input: CreateProjectInput) {
  const project = await Project.create({
    name: input.name,
    description: input.description,
    owner: new Types.ObjectId(ownerId),
    members: [new Types.ObjectId(ownerId)],
  });

  return project.populate([
    { path: 'owner', select: 'id name email' },
    { path: 'members', select: 'id name email' },
  ]);
}

export async function listProjects(userId: string) {
  const userObjectId = new Types.ObjectId(userId);
  const projects = await Project.find({
    $or: [{ owner: userObjectId }, { members: userObjectId }],
  })
    .populate('owner', 'id name email')
    .populate('members', 'id name email')
    .sort({ createdAt: -1 });

  return projects;
}

export async function getProject(projectId: string, userId: string) {
  const project = await Project.findById(projectId)
    .populate('owner', 'id name email')
    .populate('members', 'id name email');

  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  const userObjectId = new Types.ObjectId(userId);
  const isOwner = project.owner._id.equals(userObjectId);
  const isMember = project.members.some((m) =>
    (m as unknown as { _id: Types.ObjectId })._id.equals(userObjectId),
  );

  if (!isOwner && !isMember) {
    throw new AppError(403, 'Access denied: you are not a member of this project');
  }

  return project;
}

export async function addProjectMember(
  projectId: string,
  requesterId: string,
  input: AddMemberInput,
) {
  const project = await Project.findById(projectId);
  if (!project) {
    throw new AppError(404, 'Project not found');
  }

  const requesterObjectId = new Types.ObjectId(requesterId);
  if (!project.owner.equals(requesterObjectId)) {
    throw new AppError(403, 'Only the project owner can add members');
  }

  if (!Types.ObjectId.isValid(input.userId)) {
    throw new AppError(400, 'Invalid userId');
  }

  const newMemberId = new Types.ObjectId(input.userId);
  const targetUser = await User.findById(newMemberId);
  if (!targetUser) {
    throw new AppError(404, 'User not found');
  }

  const alreadyMember = project.members.some((m) => m.equals(newMemberId));
  if (alreadyMember) {
    throw new AppError(409, 'User is already a member of this project');
  }

  project.members.push(newMemberId);
  await project.save();

  return project.populate([
    { path: 'owner', select: 'id name email' },
    { path: 'members', select: 'id name email' },
  ]);
}

export function isProjectMember(
  project: {
    owner: Types.ObjectId | { _id: Types.ObjectId };
    members: (Types.ObjectId | { _id: Types.ObjectId })[];
  },
  userId: string,
): boolean {
  const userObjectId = new Types.ObjectId(userId);
  const ownerObj = project.owner as { _id?: Types.ObjectId } & Types.ObjectId;
  const ownerId = ownerObj._id ?? ownerObj;
  if (ownerId.equals(userObjectId)) return true;
  return project.members.some((m) => {
    const memberObj = m as { _id?: Types.ObjectId } & Types.ObjectId;
    const memberId = memberObj._id ?? memberObj;
    return memberId.equals(userObjectId);
  });
}
