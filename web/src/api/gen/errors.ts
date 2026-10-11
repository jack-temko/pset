// Generated from the error catalog (internal/errs) by tools/errcatalog. Do not edit.
import type { Action, Scope } from './errs';

export type ErrorId =
  | "activity.bad_id"
  | "activity.bad_question_id"
  | "activity.bad_since"
  | "activity.bad_times"
  | "activity.not_homework"
  | "activity.unknown_kind"
  | "agent.no_answer"
  | "ask.empty_question"
  | "ask.question_too_long"
  | "ask.selection_too_long"
  | "ask.turn_failed"
  | "ask.turn_not_found"
  | "book.duplicate"
  | "book.not_found"
  | "embed.failed"
  | "embed.unreachable"
  | "errors.clear_failed"
  | "errors.read_failed"
  | "events.no_streaming"
  | "homework.assignment_not_found"
  | "homework.bad_due_date"
  | "homework.bad_position"
  | "homework.bad_stage"
  | "homework.bad_url"
  | "homework.box_kind_mixed"
  | "homework.box_no_text"
  | "homework.box_off_book"
  | "homework.box_off_page"
  | "homework.draft_too_long"
  | "homework.empty_worksheet"
  | "homework.figure_busy"
  | "homework.figure_not_found"
  | "homework.file_kind"
  | "homework.file_too_big"
  | "homework.guide_exists"
  | "homework.no_boxes"
  | "homework.no_drafts"
  | "homework.no_figure"
  | "homework.no_groups"
  | "homework.no_homework_found"
  | "homework.no_page_for_question"
  | "homework.no_source"
  | "homework.not_failed"
  | "homework.note_too_long"
  | "homework.nothing_to_add"
  | "homework.page_empty"
  | "homework.page_outside"
  | "homework.page_refused"
  | "homework.page_unreachable"
  | "homework.page_unreadable"
  | "homework.pdf_unreadable"
  | "homework.question_not_found"
  | "homework.read_busy"
  | "homework.read_failed"
  | "homework.reading_empty"
  | "homework.reading_line_too_long"
  | "homework.reading_too_long"
  | "homework.reply_unreadable"
  | "homework.set_not_found"
  | "homework.text_too_long"
  | "homework.title_empty"
  | "homework.title_too_long"
  | "homework.too_many_boxes"
  | "homework.too_many_drafts"
  | "homework.too_many_lines"
  | "homework.too_many_notes"
  | "import.cancelled"
  | "import.contents_render"
  | "import.contents_stalled"
  | "import.contents_unreadable"
  | "import.failed"
  | "import.pages_unread"
  | "import.pdf_empty"
  | "import.pdf_unreadable"
  | "import.stopped"
  | "import.structure_unreadable"
  | "internal.unexpected"
  | "key.missing"
  | "key.out_of_credit"
  | "key.refused"
  | "library.bad_cover"
  | "library.bad_problem_form"
  | "library.bad_problem_where"
  | "library.no_ollama"
  | "library.not_failed"
  | "library.not_pdf"
  | "library.page_not_found"
  | "library.run_bad_offset"
  | "library.run_outside"
  | "library.runs_empty"
  | "library.title_empty"
  | "memory.empty"
  | "memory.not_found"
  | "memory.too_long"
  | "model.busy"
  | "model.cut"
  | "model.rejected"
  | "model.unknown"
  | "model.unreachable"
  | "request.foreign_origin"
  | "request.invalid_json"
  | "request.no_file"
  | "request.not_found"
  | "request.not_local"
  | "request.not_multipart"
  | "request.too_large"
  | "request.unreachable"
  | "request.upload_cut"
  | "settings.check_not_found"
  | "settings.fix_data_dir"
  | "settings.fix_database"
  | "settings.fix_ollama"
  | "settings.key_empty"
  | "settings.name_too_long"
  | "settings.not_fixable"
  | "settings.test_failed"
  | "update.already_installing"
  | "update.bad_tag"
  | "update.check_unreachable"
  | "update.download_failed"
  | "update.github_error"
  | "update.no_program_file"
  | "update.no_release"
  | "update.no_release_key"
  | "update.not_for_this_computer"
  | "update.not_trusted"
  | "update.not_writable"
  | "update.nothing_to_install"
  | "update.replace_failed"
  | "update.source_build"
  | "update.unreadable_release"
  | "update.unsupported_system"
;

export interface CatalogEntry {
  what: string;
  why?: string;
  fix?: string;
  action?: Action;
  scope: Scope;
  status: number;
  owner: string;
}

export const ERRORS: Record<ErrorId, CatalogEntry> = {
  "activity.bad_id": {
    what: "Name the stretch with an id of up to 64 characters.",
    scope: "field",
    status: 422,
    owner: "activity",
  },
  "activity.bad_question_id": {
    what: "A question's id is up to 64 characters.",
    scope: "field",
    status: 422,
    owner: "activity",
  },
  "activity.bad_since": {
    what: "Say when the week starts, as an RFC 3339 time.",
    scope: "field",
    status: 422,
    owner: "activity",
  },
  "activity.bad_times": {
    what: "Say when the stretch started and ended, as RFC 3339 times.",
    scope: "field",
    status: 422,
    owner: "activity",
  },
  "activity.not_homework": {
    what: "Only homework time is for a question.",
    scope: "field",
    status: 422,
    owner: "activity",
  },
  "activity.unknown_kind": {
    what: "There's no activity called {kind}.",
    scope: "field",
    status: 422,
    owner: "activity",
  },
  "agent.no_answer": {
    what: "The model stopped without writing an answer.",
    why: "It ended its turn with nothing written, even when asked again.",
    fix: "Trying again usually works.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "agent",
  },
  "ask.empty_question": {
    what: "Ask something.",
    scope: "field",
    status: 422,
    owner: "ask",
  },
  "ask.question_too_long": {
    what: "That's too long for one question.",
    scope: "field",
    status: 422,
    owner: "ask",
  },
  "ask.selection_too_long": {
    what: "That selection is too long to ask about. Pick a smaller piece.",
    scope: "field",
    status: 422,
    owner: "ask",
  },
  "ask.turn_failed": {
    what: "Couldn't answer that.",
    why: "Something went wrong while the tutor was answering.",
    fix: "Ask again.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "ask",
  },
  "ask.turn_not_found": {
    what: "That question isn't in this conversation.",
    why: "It was cleared, or the page is out of date.",
    fix: "Reload the page to see the conversation as it is now.",
    action: "reload",
    scope: "inline",
    status: 404,
    owner: "ask",
  },
  "book.duplicate": {
    what: "{title} is already on your shelf.",
    why: "This is the same file as a book you already added.",
    fix: "Open the one on your shelf.",
    action: "open_book",
    scope: "inline",
    status: 409,
    owner: "library",
  },
  "book.not_found": {
    what: "That book isn't on your shelf.",
    why: "It was removed, or the link is out of date.",
    fix: "Go back to your shelf and open it from there.",
    scope: "inline",
    status: 404,
    owner: "errs",
  },
  "embed.failed": {
    what: "Ollama couldn't build the book's search.",
    why: "Ollama answered with an error. It may be out of memory or missing its model.",
    fix: "Settings, under Health, says how to check it, then try again.",
    action: "open_settings",
    scope: "inline",
    status: 502,
    owner: "llm",
  },
  "embed.unreachable": {
    what: "PSet couldn't reach Ollama.",
    why: "Ollama searches your books, and it isn't running or isn't answering.",
    fix: "Settings, under Health, says how to start it.",
    action: "open_settings",
    scope: "inline",
    status: 502,
    owner: "llm",
  },
  "errors.clear_failed": {
    what: "Couldn't clear the list of errors.",
    why: "PSet's database didn't answer.",
    fix: "Try again. If it keeps happening, check the database in Settings.",
    action: "retry",
    scope: "inline",
    status: 500,
    owner: "errlog",
  },
  "errors.read_failed": {
    what: "Couldn't read the list of errors.",
    why: "PSet's database didn't answer.",
    fix: "Try again. If it keeps happening, check the database in Settings.",
    action: "retry",
    scope: "inline",
    status: 500,
    owner: "errlog",
  },
  "events.no_streaming": {
    what: "PSet can't keep this page up to date.",
    why: "The connection between the page and PSet can't carry live updates.",
    fix: "Reload the page. If it keeps happening, report it with the details.",
    action: "reload",
    scope: "inline",
    status: 500,
    owner: "events",
  },
  "homework.assignment_not_found": {
    what: "That assignment isn't there.",
    why: "It was dismissed, or the page is out of date.",
    fix: "Add the assignment again.",
    scope: "inline",
    status: 404,
    owner: "homework",
  },
  "homework.bad_due_date": {
    what: "That isn't a date.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.bad_position": {
    what: "Position {to} is outside the set (1 to {n}).",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.bad_stage": {
    what: "There's no stage called {stage}.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.bad_url": {
    what: "That isn't a web page's address.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.box_kind_mixed": {
    what: "A box is either the problem's words or a figure.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.box_no_text": {
    what: "Box the problem's words too, not only its figure.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.box_off_book": {
    what: "A box is on a page the book doesn't have.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.box_off_page": {
    what: "A box runs off its page.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.draft_too_long": {
    what: "One of these is too long for a single question.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.empty_worksheet": {
    what: "There is nothing to print yet.",
    why: "A worksheet needs at least one question.",
    fix: "Add a question before printing the worksheet.",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.figure_busy": {
    what: "Its figure is still being read.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.figure_not_found": {
    what: "That figure isn't there.",
    why: "The question has no figure, or it was removed.",
    fix: "Reload the page to see the question as it is now.",
    action: "reload",
    scope: "inline",
    status: 404,
    owner: "homework",
  },
  "homework.file_kind": {
    what: "Send a PDF, a photo, or a text file.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.file_too_big": {
    what: "That file is too big for an assignment.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.guide_exists": {
    what: "This question already has a guide, or is being written.",
    why: "A guide was started for it a moment ago, so the page is out of date.",
    fix: "Reload the page to see the guide.",
    action: "reload",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.no_boxes": {
    what: "Draw a box around the problem first.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.no_drafts": {
    what: "Write at least one question.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.no_figure": {
    what: "This question has no figure to read.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.no_groups": {
    what: "Pick at least one due date to add.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.no_homework_found": {
    what: "Didn't find any homework in it.",
    why: "The model read it and found no problems to do.",
    fix: "If the homework is there, paste just that part.",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.no_page_for_question": {
    what: "This question isn't in the book, so it has no page.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.no_source": {
    what: "Give a file, a web page's address, or the assignment's text.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.not_failed": {
    what: "Only a question that failed can be tried again.",
    why: "This question isn't in a failed state, so the page is out of date.",
    fix: "Reload the page to see where the question stands.",
    action: "reload",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.note_too_long": {
    what: "Keep each note under {max} characters.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.nothing_to_add": {
    what: "There's nothing left to add or change in those.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.page_empty": {
    what: "That page has no text to read.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.page_outside": {
    what: "The book doesn't have that page.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.page_refused": {
    what: "That page answered {status}. A page behind a login can be pasted or photographed instead.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.page_unreachable": {
    what: "Couldn't reach that page.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.page_unreadable": {
    what: "Couldn't read that page.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.pdf_unreadable": {
    what: "That PDF couldn't be read.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.question_not_found": {
    what: "That question isn't there.",
    why: "It was removed, or the page is out of date.",
    fix: "Go back to the set's list of questions.",
    scope: "inline",
    status: 404,
    owner: "homework",
  },
  "homework.read_busy": {
    what: "That assignment is already read, or being read.",
    why: "It isn't in a failed state, so there is nothing to try again.",
    fix: "Reload the page to see where it stands.",
    action: "reload",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.read_failed": {
    what: "Couldn't read the assignment.",
    why: "Something went wrong while PSet was reading it.",
    fix: "Try again, or paste just the part with the problems.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.reading_empty": {
    what: "Write at least one line.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.reading_line_too_long": {
    what: "Keep each line under {max} characters.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.reading_too_long": {
    what: "Keep it to {max} lines.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.reply_unreadable": {
    what: "Couldn't make out the assignment's homework.",
    why: "The model's answer wasn't in a form PSet could read.",
    fix: "Try again, or paste just the part with the problems.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "homework",
  },
  "homework.set_not_found": {
    what: "That homework set isn't there.",
    why: "It was removed, or the page is out of date.",
    fix: "Go back to the book's homework list.",
    scope: "inline",
    status: 404,
    owner: "homework",
  },
  "homework.text_too_long": {
    what: "That's too long for a single question.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.title_empty": {
    what: "Give it a title.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.title_too_long": {
    what: "Keep the title under {max} characters.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.too_many_boxes": {
    what: "That's more than {max} boxes for one problem.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.too_many_drafts": {
    what: "That's more than {max} questions at once. Add them in smaller batches.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.too_many_lines": {
    what: "That's more than {max} lines at once.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "homework.too_many_notes": {
    what: "Keep it to {max} notes.",
    scope: "field",
    status: 422,
    owner: "homework",
  },
  "import.cancelled": {
    what: "{title} was cancelled before it started.",
    why: "You stopped it before PSet began.",
    fix: "Try again to start it.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.contents_render": {
    what: "PSet couldn't render the book's contents pages.",
    why: "The pages couldn't be turned into pictures for the model.",
    fix: "Try again.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.contents_stalled": {
    what: "The model stopped answering while PSet read the book's contents.",
    why: "OpenRouter took too long to answer.",
    fix: "Try again in a minute.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.contents_unreadable": {
    what: "The model's answer about the book's contents couldn't be read.",
    why: "It wasn't in a form PSet could use.",
    fix: "Try again.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.failed": {
    what: "Couldn't prepare {title}.",
    why: "Something went wrong while PSet was preparing it.",
    fix: "Try again.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.pages_unread": {
    what: "Some pages couldn't be read.",
    why: "PSet's text reader, Tesseract, failed on {count} ({list}).",
    fix: "Try again, or check that Tesseract works in Settings.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.pdf_empty": {
    what: "This PDF has no pages.",
    why: "The file opened but holds nothing to read.",
    fix: "Try a different copy of the file.",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.pdf_unreadable": {
    what: "This PDF can't be read.",
    why: "PSet couldn't open it, so it may be damaged or locked.",
    fix: "Try a different copy of the file.",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.stopped": {
    what: "{title} was stopped.",
    why: "You stopped it before it finished.",
    fix: "Try again to carry on where it left off.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "import.structure_unreadable": {
    what: "PSet couldn't read this book's structure.",
    why: "The PDF's outline couldn't be extracted.",
    fix: "Try again. If it keeps happening, the file may be damaged.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "internal.unexpected": {
    what: "Something went wrong inside PSet.",
    why: "PSet hit a problem it has no name for.",
    fix: "Try again. If it keeps happening, copy the details and report it.",
    action: "retry",
    scope: "inline",
    status: 500,
    owner: "errs",
  },
  "key.missing": {
    what: "There's no OpenRouter key yet.",
    why: "PSet needs a key to read pages and write answers.",
    fix: "Add your key in Settings, under Connections.",
    action: "open_settings",
    scope: "inline",
    status: 422,
    owner: "llm",
  },
  "key.out_of_credit": {
    what: "Your OpenRouter account is out of credit.",
    why: "Your OpenRouter account is out of credit, so PSet can't use a model.",
    fix: "Add credit on OpenRouter, then try again.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "llm",
  },
  "key.refused": {
    what: "OpenRouter refused the key.",
    why: "The key in Settings may be wrong, expired or deleted.",
    fix: "Check the key in Settings, then try again.",
    action: "open_settings",
    scope: "inline",
    status: 422,
    owner: "llm",
  },
  "library.bad_cover": {
    what: "That isn't one of the cover colours.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.bad_problem_form": {
    what: "That isn't a way of numbering problems.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.bad_problem_where": {
    what: "Problems sit after each section or at each chapter's end.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.no_ollama": {
    what: "PSet can't reach Ollama.",
    why: "Ollama searches your books, and it isn't answering.",
    fix: "Settings, under Health, says how to start it.",
    action: "open_settings",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "library.not_failed": {
    what: "Only a book that failed to import can be tried again.",
    why: "This book isn't in a failed state, so the page is out of date.",
    fix: "Reload the page to see where the book stands.",
    action: "reload",
    scope: "inline",
    status: 422,
    owner: "library",
  },
  "library.not_pdf": {
    what: "That isn't a PDF.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.page_not_found": {
    what: "That page isn't in this book.",
    why: "The page number is past the end of the book, or isn't a number.",
    fix: "Go to a page inside the book.",
    scope: "inline",
    status: 404,
    owner: "library",
  },
  "library.run_bad_offset": {
    what: "PDF page {from} can't be printed as page {printed}.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.run_outside": {
    what: "Each PDF page has to be inside the book: 1 to {max}.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.runs_empty": {
    what: "Say where printed page 1 is.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "library.title_empty": {
    what: "A book needs a title.",
    scope: "field",
    status: 422,
    owner: "library",
  },
  "memory.empty": {
    what: "Write what to remember.",
    scope: "field",
    status: 422,
    owner: "memory",
  },
  "memory.not_found": {
    what: "That memory isn't there.",
    why: "It was already forgotten, or the list is out of date.",
    fix: "Reload the page to see what is remembered now.",
    action: "reload",
    scope: "inline",
    status: 404,
    owner: "memory",
  },
  "memory.too_long": {
    what: "Keep it to a sentence or two ({max} characters at most).",
    scope: "field",
    status: 422,
    owner: "memory",
  },
  "model.busy": {
    what: "OpenRouter didn't answer properly.",
    why: "OpenRouter is busy or having trouble right now.",
    fix: "Try again in a minute.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "llm",
  },
  "model.cut": {
    what: "The model's answer stopped partway.",
    why: "The connection to the model dropped while it was writing.",
    fix: "Trying again usually works.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "llm",
  },
  "model.rejected": {
    what: "OpenRouter turned the request down.",
    why: "OpenRouter refused it for a reason PSet has no name for.",
    fix: "Try again. If it keeps happening, copy the details and report it.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "llm",
  },
  "model.unknown": {
    what: "OpenRouter doesn't know a model PSet uses.",
    why: "A model PSet relies on was renamed or removed.",
    fix: "Check for a PSet update.",
    action: "check_update",
    scope: "inline",
    status: 422,
    owner: "llm",
  },
  "model.unreachable": {
    what: "PSet couldn't reach OpenRouter.",
    why: "The internet connection is down, or OpenRouter didn't answer in time.",
    fix: "Check the internet connection, then try again.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "llm",
  },
  "request.foreign_origin": {
    what: "PSet refused that change.",
    why: "PSet takes changes only from its own page.",
    fix: "Make the change from PSet's own page.",
    scope: "inline",
    status: 403,
    owner: "errs",
  },
  "request.invalid_json": {
    what: "PSet couldn't read what was sent.",
    why: "The page and PSet's server are out of step, which happens after an update.",
    fix: "Reload the page and try again.",
    action: "reload",
    scope: "inline",
    status: 400,
    owner: "errs",
  },
  "request.no_file": {
    what: "No file came with the upload.",
    scope: "field",
    status: 422,
    owner: "httpx",
  },
  "request.not_found": {
    what: "PSet's server doesn't have what the page asked for.",
    why: "The page and the server are out of step, which happens after an update.",
    fix: "Reload the page.",
    action: "reload",
    scope: "inline",
    status: 404,
    owner: "errs",
  },
  "request.not_local": {
    what: "PSet refused that request.",
    why: "PSet answers only requests addressed to this computer, as localhost.",
    fix: "Open PSet at http://localhost and try again.",
    scope: "inline",
    status: 403,
    owner: "errs",
  },
  "request.not_multipart": {
    what: "Send the file as a multipart upload.",
    scope: "field",
    status: 422,
    owner: "httpx",
  },
  "request.too_large": {
    what: "That's too much to send in one request.",
    why: "A single request is limited to {limit} MB.",
    fix: "Send it in smaller pieces.",
    scope: "inline",
    status: 413,
    owner: "errs",
  },
  "request.unreachable": {
    what: "PSet can't reach its server.",
    why: "The server may have stopped, or the computer went to sleep.",
    fix: "Start PSet again, then try again.",
    action: "retry",
    scope: "screen",
    status: 422,
    owner: "errs",
  },
  "request.upload_cut": {
    what: "The upload was cut off.",
    scope: "field",
    status: 422,
    owner: "httpx",
  },
  "settings.check_not_found": {
    what: "PSet has no such check.",
    why: "The page and PSet are out of step, which happens after an update.",
    fix: "Reload the page.",
    action: "reload",
    scope: "inline",
    status: 404,
    owner: "settings",
  },
  "settings.fix_data_dir": {
    what: "Couldn't create the data folder.",
    why: "PSet isn't allowed to create it there, or the disk is full.",
    fix: "Create the folder yourself, or free up space, then check again.",
    scope: "inline",
    status: 422,
    owner: "settings",
  },
  "settings.fix_database": {
    what: "Couldn't update the database.",
    why: "The database can't be brought up to date, which means it is damaged or comes from a newer PSet.",
    fix: "Update PSet. If that doesn't help, reset PSet from this page.",
    scope: "inline",
    status: 422,
    owner: "settings",
  },
  "settings.fix_ollama": {
    what: "Ollama couldn't download {model}.",
    why: "Ollama isn't running, or the download was cut off.",
    fix: "Start Ollama and check the internet connection, then try again.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "settings",
  },
  "settings.key_empty": {
    what: "Paste your OpenRouter key first.",
    scope: "field",
    status: 422,
    owner: "settings",
  },
  "settings.name_too_long": {
    what: "Keep it under {max} characters.",
    scope: "field",
    status: 422,
    owner: "settings",
  },
  "settings.not_fixable": {
    what: "PSet can't fix this one itself.",
    why: "Fixing it needs something installed or changed outside PSet.",
    fix: "Follow the steps listed with the check, then check again.",
    scope: "inline",
    status: 422,
    owner: "settings",
  },
  "settings.test_failed": {
    what: "Couldn't connect with that key.",
    why: "PSet couldn't finish the test.",
    fix: "Try again in a minute.",
    action: "retry",
    scope: "inline",
    status: 422,
    owner: "settings",
  },
  "update.already_installing": {
    what: "An update is already being installed.",
    why: "Another request started it a moment ago.",
    fix: "Wait for PSet to restart.",
    scope: "inline",
    status: 409,
    owner: "update",
  },
  "update.bad_tag": {
    what: "Couldn't look for an update.",
    why: "The latest release is tagged {tag}, which isn't a version number.",
    fix: "Try again later. If it keeps happening, copy the details and report it.",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.check_unreachable": {
    what: "Couldn't look for an update.",
    why: "PSet couldn't reach GitHub.",
    fix: "Check the internet connection, then try again.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.download_failed": {
    what: "The update wasn't installed.",
    why: "The download failed or broke off. Nothing was changed.",
    fix: "Check the internet connection, then try again.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.github_error": {
    what: "Couldn't look for an update.",
    why: "GitHub answered with an error (HTTP {status}).",
    fix: "Try again in a minute.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.no_program_file": {
    what: "PSet can't update itself here.",
    why: "PSet can't find its own program file.",
    fix: "Run the installer again.",
    scope: "inline",
    status: 422,
    owner: "update",
  },
  "update.no_release": {
    what: "There is no published release yet.",
    why: "No version of PSet has been published to update to.",
    scope: "inline",
    status: 404,
    owner: "update",
  },
  "update.no_release_key": {
    what: "PSet can't update itself here.",
    why: "This build has no release key, so it can't tell a real update from a fake one.",
    fix: "Install an official release.",
    scope: "inline",
    status: 422,
    owner: "update",
  },
  "update.not_for_this_computer": {
    what: "The update wasn't installed.",
    why: "This release has no build that runs on this computer. Nothing was changed.",
    fix: "Check the releases page for a build that does.",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.not_trusted": {
    what: "The update wasn't installed.",
    why: "PSet couldn't verify the download, so it threw it away. Nothing was changed.",
    fix: "Try again later. If it keeps happening, copy the details and report it.",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.not_writable": {
    what: "PSet can't update itself here.",
    why: "PSet can't write to {dir}, where it is installed, so it can't replace itself.",
    fix: "Run the installer again instead.",
    scope: "inline",
    status: 422,
    owner: "update",
  },
  "update.nothing_to_install": {
    what: "There is no newer version to install.",
    why: "PSet hasn't found one yet.",
    fix: "Check for updates first.",
    scope: "inline",
    status: 422,
    owner: "update",
  },
  "update.replace_failed": {
    what: "The update wasn't installed.",
    why: "PSet couldn't put the new program in place. Nothing was changed.",
    fix: "Make sure PSet's folder can be written to, or run the installer again.",
    scope: "inline",
    status: 500,
    owner: "update",
  },
  "update.source_build": {
    what: "PSet can't update itself here.",
    why: "This is a build from source.",
    fix: "Update it by pulling and rebuilding.",
    scope: "inline",
    status: 422,
    owner: "update",
  },
  "update.unreadable_release": {
    what: "Couldn't look for an update.",
    why: "GitHub's answer wasn't in a shape PSet can read.",
    fix: "Try again later. If it keeps happening, copy the details and report it.",
    action: "retry",
    scope: "inline",
    status: 502,
    owner: "update",
  },
  "update.unsupported_system": {
    what: "PSet can't update itself here.",
    why: "Updating itself isn't supported on this system.",
    fix: "Run the installer for the new version instead.",
    scope: "inline",
    status: 422,
    owner: "update",
  },
};
