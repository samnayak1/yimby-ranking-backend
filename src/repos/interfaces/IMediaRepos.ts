import { Creator, NewCreator, NewResource, Resource, ResourceCategory } from '../../models';

export interface ICreatorRepo {
  findAll(): Creator[];
  findById(id: number): Creator | null;
  create(data: NewCreator): Creator;
  update(id: number, data: Partial<NewCreator>): Creator | null;
  delete(id: number): boolean;
}

export interface IResourceRepo {
  findAll(category?: ResourceCategory): Resource[];
  findById(id: number): Resource | null;
  create(data: NewResource): Resource;
  update(id: number, data: Partial<NewResource>): Resource | null;
  delete(id: number): boolean;
}
