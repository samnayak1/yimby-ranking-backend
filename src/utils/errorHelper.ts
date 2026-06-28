


export const createError=(status: number, message: string) =>{
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}