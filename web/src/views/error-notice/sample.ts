import { mockError } from '@/views/mock/errors';

/** The sample failure everywhere: importing "Calculus" failed because the
 *  account is out of credit. The chain is what the server sends: the import
 *  as the outer entry, the key under it. */
export const IMPORT_FAILED = mockError(
  ['import.failed', 'key.out_of_credit'],
  { title: 'Calculus' },
  'E7K2QF',
);
