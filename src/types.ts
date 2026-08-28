export interface DocumentMeta {
  id: string;
  userId: string;
  name: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  isBackedUp: boolean;
  cloudPath?: string;
}

export interface LocalDocument extends Omit<DocumentMeta, 'userId'> {
  data: ArrayBuffer;
}
