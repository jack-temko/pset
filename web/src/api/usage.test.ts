import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';

import { emit } from './events';
import './usage';

describe('usage cache', () => {
  it.each([
    'question.changed',
    'question.removed',
    'assignment.changed',
    'assignment.removed',
    'homework.removed',
    'turn.changed',
    'turns.cleared',
    'book.changed',
  ])('is marked stale on %s', (type) => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    emit(type, {}, qc);
    expect(spy).toHaveBeenCalledWith(
      { queryKey: ['usage'] },
      { cancelRefetch: false },
    );
  });
});
