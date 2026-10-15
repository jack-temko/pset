import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Menu, MenuItem } from '.';

// React reads this to know updates are wrapped in act().
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  host.remove();
});

const click = (el: Element | null) => {
  act(() => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
};
const trigger = (label: string) =>
  host.querySelector(`[aria-label="${label}"]`);
const openMenus = () =>
  [...document.querySelectorAll('[role="menu"]')].map((m) =>
    m.getAttribute('aria-label'),
  );

function render() {
  act(() => {
    root.render(
      <>
        <Menu label="Set">
          <MenuItem onSelect={() => {}}>Edit</MenuItem>
        </Menu>
        <Menu label="Question">
          <MenuItem onSelect={() => {}}>Move up</MenuItem>
        </Menu>
        <Menu label="Questions" trigger="2 of 8">
          <MenuItem current onSelect={() => {}}>
            4.25
          </MenuItem>
          <MenuItem onSelect={() => {}}>4.32</MenuItem>
        </Menu>
      </>,
    );
  });
}

describe('Menu', () => {
  it('opens under its trigger and closes after an item runs', () => {
    render();
    click(trigger('Set'));
    expect(openMenus()).toEqual(['Set']);
    click(document.querySelector('[role="menuitem"]'));
    expect(openMenus()).toEqual([]);
  });

  it('is one at a time: opening another closes the first, with no press outside', () => {
    render();
    click(trigger('Set'));
    click(trigger('Question'));
    expect(openMenus()).toEqual(['Question']);
    click(trigger('Questions'));
    expect(openMenus()).toEqual(['Questions']);
  });

  it('closes on Esc and puts focus back on its trigger', () => {
    render();
    click(trigger('Set'));
    act(
      () =>
        void document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        ),
    );
    expect(openMenus()).toEqual([]);
    expect(document.activeElement).toBe(trigger('Set'));
  });

  it('opens focus on the current row of a list of places', () => {
    render();
    click(trigger('Questions'));
    const current = document.querySelector('[aria-current="true"]');
    expect(current?.textContent).toBe('4.25');
    expect(document.activeElement).toBe(current);
  });

  it('names the trigger and shows its own content, not the ellipsis', () => {
    render();
    expect(trigger('Questions')?.textContent).toContain('2 of 8');
    expect(trigger('Set')?.textContent).toBe('');
  });
});
