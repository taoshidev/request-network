export class BaseDTO {
  id?: string;
  active?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
  constructor(data: Partial<BaseDTO>) {
    Object.assign(this, data);
  }
}
