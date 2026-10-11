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

describe('usage events and the books', () => {
  it("mark the shelf and each book stale for its usage shape, not a book's contents", () => {
    const qc = new QueryClient();
    qc.setQueryData(['books'], []);
    qc.setQueryData(['books', 'b1'], {});
    qc.setQueryData(['books', 'b1', 'contents'], {});
    qc.setQueryData(['usage', 'b1'], {});
    emit('turn.changed', {}, qc);
    const stale = (key: unknown[]) => qc.getQueryState(key)?.isInvalidated;
    expect(stale(['books'])).toBe(true);
    expect(stale(['books', 'b1'])).toBe(true);
    expect(stale(['books', 'b1', 'contents'])).toBe(false);
    expect(stale(['usage', 'b1'])).toBe(true);
  });

  it('leave the books to the book event itself', () => {
    const qc = new QueryClient();
    qc.setQueryData(['books', 'b1'], {});
    emit('book.changed', {}, qc);
    expect(qc.getQueryState(['books', 'b1'])?.isInvalidated).toBe(false);
  });
});
