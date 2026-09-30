import { useRef, useState } from 'react'
import { Check, ChevronDown, ChevronUp, Pencil, Plus, Printer, Trash2 } from 'lucide-react'
import { Box, BoxBody } from '@/components/box'
import { Button, IconButton } from '@/components/button'
import { Menu, MenuCheckItem, MenuConfirmItem, MenuDivider, MenuItem } from '@/components/menu'
import { ConfirmPopover } from '@/components/confirm'
import { Dialog } from '@/components/dialog'
import { cn } from '@/lib/utils'
import type { ComponentEntry } from './types'
import { Shelf } from './shared'

function MenuDemo() {
  const [on, setOn] = useState(false)
  return (
    <Menu label="Homework actions">
      <MenuItem icon={<Plus />} onSelect={() => {}}>
        Add questions
      </MenuItem>
      <MenuItem onSelect={() => {}}>Edit homework</MenuItem>
      <MenuItem icon={<Printer />} hint="3 still being found" onSelect={() => {}}>
        Print worksheet
      </MenuItem>
      <MenuDivider />
      <MenuCheckItem checked={on} onChange={() => setOn((v) => !v)}>
        Turned in
      </MenuCheckItem>
    </Menu>
  )
}

/** The confirm in its three homes: a control in a row (a question's
 *  trash), a menu's last item (Delete homework), a button in a Box
 *  (Settings' Reset). */
function QuestionHeaderDemo() {
  const [asking, setAsking] = useState(false)
  const trash = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex w-96 items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-lg font-semibold">3.A.4</span>
      <IconButton variant="ghost" size="sm" aria-label="Move this question up">
        <ChevronUp />
      </IconButton>
      <IconButton variant="ghost" size="sm" aria-label="Move this question down">
        <ChevronDown />
      </IconButton>
      <IconButton
        ref={trash}
        variant="ghost"
        size="sm"
        aria-label="Remove this question"
        aria-expanded={asking}
        className={cn(asking && 'bg-muted/50 text-foreground')}
        onClick={() => setAsking(true)}
      >
        <Trash2 />
      </IconButton>
      {asking && (
        <ConfirmPopover
          anchor={trash}
          question="Remove 3.A.4?"
          detail="Its guide, what you revealed and its Complete go with it."
          action="Remove"
          onConfirm={() => setAsking(false)}
          onCancel={() => setAsking(false)}
        />
      )}
    </div>
  )
}

/** A dropdown with a labelled trigger and a current row: the homework
 *  header's count, which lists the set's questions. */
function QuestionsMenuDemo() {
  return (
    <Menu label="Questions" trigger="2 of 8">
      <MenuItem icon={<Check className="text-success!" />} hint="Done" onSelect={() => {}}>
        4.27
      </MenuItem>
      <MenuItem icon={<Check className="text-success!" />} hint="Done" onSelect={() => {}}>
        4.25
      </MenuItem>
      <MenuItem current hint="Here" onSelect={() => {}}>
        4.32
      </MenuItem>
      <MenuItem hint="Waiting" onSelect={() => {}}>
        3.12
      </MenuItem>
    </Menu>
  )
}

function HomeworkMenuDemo() {
  return (
    <Menu label="Homework actions">
      <MenuItem icon={<Plus />} onSelect={() => {}}>
        Add questions
      </MenuItem>
      <MenuItem icon={<Pencil />} onSelect={() => {}}>
        Edit homework
      </MenuItem>
      <MenuItem icon={<Printer />} onSelect={() => {}}>
        Print worksheet
      </MenuItem>
      <MenuDivider />
      <MenuCheckItem checked={false} onChange={() => {}}>
        Turn in
      </MenuCheckItem>
      <MenuDivider />
      <MenuConfirmItem
        icon={<Trash2 />}
        question="Delete Set 3?"
        detail="Its 8 questions go with it, with their guides and what you checked off."
        action="Delete homework"
        onConfirm={() => {}}
      >
        Delete homework
      </MenuConfirmItem>
    </Menu>
  )
}

function ResetDemo() {
  const [asking, setAsking] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  return (
    <Box tone="destructive" className="w-full">
      <BoxBody className="flex min-h-control items-center gap-3 text-sm">
        <span className="min-w-0 flex-1 text-muted-foreground">Erase every book, set, conversation and setting.</span>
        <Button ref={button} variant="outline" size="sm" className="text-destructive" onClick={() => setAsking(true)}>
          Reset everything
        </Button>
        {asking && (
          <ConfirmPopover
            anchor={button}
            question="Reset everything?"
            detail="Deletes 4 books, 12 homework sets and 2 conversations, and your settings, API key included."
            action="Reset everything"
            onConfirm={() => setAsking(false)}
            onCancel={() => setAsking(false)}
          />
        )}
      </BoxBody>
    </Box>
  )
}

function DialogDemo({ width }: { width: 'default' | 'wide' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the {width === 'wide' ? '560' : '400'} dialog
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        width={width}
        title={width === 'wide' ? 'Add questions' : 'New homework'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setOpen(false)}>
              {width === 'wide' ? 'Add 2 questions' : 'Create'}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Cancel and Esc close it. The scrim does not: a dialog holding half a
          pasted assignment must not vanish to a stray click.
        </p>
      </Dialog>
    </>
  )
}

export const overlaysSections: ComponentEntry[] = [
  {
    id: 'menu',
    title: 'Menu',
    group: 'Overlays',
    note: 'The actions a bar has room to name but not to show. Closes on Esc, outside, or after an item runs; arrows move between items.',
    docs: ['menu'],
    Demo: () => (
      <>
        <Shelf label="overflow">
          <MenuDemo />
        </Shelf>
        <Shelf label="labelled trigger, current row">
          <QuestionsMenuDemo />
        </Shelf>
        <Shelf label="one at a time">
          <MenuDemo />
          <QuestionsMenuDemo />
          <HomeworkMenuDemo />
          <p className="text-xs text-muted-foreground">Open one, then another: the first closes. Menus never stack.</p>
        </Shelf>
      </>
    ),
  },
  {
    id: 'confirm',
    title: 'Confirm',
    group: 'Overlays',
    note: 'A destructive act asks where you asked: a small card under the control, one sentence of what goes, Cancel focused, the act never under the pointer. From a menu, the menu stays open behind it.',
    docs: ['confirm'],
    Demo: () => (
      <>
        <Shelf label="from a control">
          <QuestionHeaderDemo />
        </Shelf>
        <Shelf label="from a menu">
          <HomeworkMenuDemo />
        </Shelf>
        <Shelf label="from a button">
          <ResetDemo />
        </Shelf>
      </>
    ),
  },
  {
    id: 'dialog',
    title: 'Dialog',
    group: 'Overlays',
    note: 'The one modal: a native <dialog>, two widths, an inert scrim. Cancel and Esc are the only ways out. No X in the corner.',
    docs: ['dialog'],
    Demo: () => (
      <>
        <Shelf label="400">
          <DialogDemo width="default" />
        </Shelf>
        <Shelf label="560">
          <DialogDemo width="wide" />
        </Shelf>
      </>
    ),
  },
]
