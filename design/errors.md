<!-- Generated from the error catalog (internal/errs) by tools/errcatalog. Do not edit. -->

# Errors

Every error PSet can show. An id is stable; the words are read from the catalog when shown. How to add one, and how a chain of errors is composed, is in `design/backend.md`, Errors.

132 entries.

| Id | What | Why | Fix | Action | Scope | Owner |
|---|---|---|---|---|---|---|
| `activity.bad_id` | Name the stretch with an id of up to 64 characters. |  |  |  | field | activity |
| `activity.bad_question_id` | A question's id is up to 64 characters. |  |  |  | field | activity |
| `activity.bad_since` | Say when the week starts, as an RFC 3339 time. |  |  |  | field | activity |
| `activity.bad_times` | Say when the stretch started and ended, as RFC 3339 times. |  |  |  | field | activity |
| `activity.not_homework` | Only homework time is for a question. |  |  |  | field | activity |
| `activity.unknown_kind` | There's no activity called {kind}. |  |  |  | field | activity |
| `agent.no_answer` | The model stopped without writing an answer. | It ended its turn with nothing written, even when asked again. | Trying again usually works. | `retry` | inline | agent |
| `ask.empty_question` | Ask something. |  |  |  | field | ask |
| `ask.question_too_long` | That's too long for one question. |  |  |  | field | ask |
| `ask.selection_too_long` | That selection is too long to ask about. Pick a smaller piece. |  |  |  | field | ask |
| `ask.turn_failed` | Couldn't answer that. | Something went wrong while the tutor was answering. | Ask again. | `retry` | inline | ask |
| `ask.turn_not_found` | That question isn't in this conversation. | It was cleared, or the page is out of date. | Reload the page to see the conversation as it is now. | `reload` | inline | ask |
| `book.duplicate` | {title} is already on your shelf. | This is the same file as a book you already added. | Open the one on your shelf. | `open_book` | inline | library |
| `book.not_found` | That book isn't on your shelf. | It was removed, or the link is out of date. | Go back to your shelf and open it from there. |  | inline | errs |
| `embed.failed` | Ollama couldn't build the book's search. | Ollama answered with an error. It may be out of memory or missing its model. | Settings, under Health, says how to check it, then try again. | `open_settings` | inline | llm |
| `embed.unreachable` | PSet couldn't reach Ollama. | Ollama searches your books, and it isn't running or isn't answering. | Settings, under Health, says how to start it. | `open_settings` | inline | llm |
| `errors.clear_failed` | Couldn't clear the list of errors. | PSet's database didn't answer. | Try again. If it keeps happening, check the database in Settings. | `retry` | inline | errlog |
| `errors.read_failed` | Couldn't read the list of errors. | PSet's database didn't answer. | Try again. If it keeps happening, check the database in Settings. | `retry` | inline | errlog |
| `events.no_streaming` | PSet can't keep this page up to date. | The connection between the page and PSet can't carry live updates. | Reload the page. If it keeps happening, report it with the details. | `reload` | inline | events |
| `homework.assignment_not_found` | That assignment isn't there. | It was dismissed, or the page is out of date. | Add the assignment again. |  | inline | homework |
| `homework.bad_due_date` | That isn't a date. |  |  |  | field | homework |
| `homework.bad_position` | Position {to} is outside the set (1 to {n}). |  |  |  | field | homework |
| `homework.bad_stage` | There's no stage called {stage}. |  |  |  | field | homework |
| `homework.bad_url` | That isn't a web page's address. |  |  |  | field | homework |
| `homework.box_kind_mixed` | A box is either the problem's words or a figure. |  |  |  | field | homework |
| `homework.box_no_text` | Box the problem's words too, not only its figure. |  |  |  | field | homework |
| `homework.box_off_book` | A box is on a page the book doesn't have. |  |  |  | field | homework |
| `homework.box_off_page` | A box runs off its page. |  |  |  | field | homework |
| `homework.draft_too_long` | One of these is too long for a single question. |  |  |  | field | homework |
| `homework.empty_worksheet` | There is nothing to print yet. | A worksheet needs at least one question. | Add a question before printing the worksheet. |  | inline | homework |
| `homework.figure_busy` | Its figure is still being read. |  |  |  | field | homework |
| `homework.figure_not_found` | That figure isn't there. | The question has no figure, or it was removed. | Reload the page to see the question as it is now. | `reload` | inline | homework |
| `homework.file_kind` | Send a PDF, a photo, or a text file. |  |  |  | field | homework |
| `homework.file_too_big` | That file is too big for an assignment. |  |  |  | field | homework |
| `homework.guide_exists` | This question already has a guide, or is being written. | A guide was started for it a moment ago, so the page is out of date. | Reload the page to see the guide. | `reload` | inline | homework |
| `homework.no_boxes` | Draw a box around the problem first. |  |  |  | field | homework |
| `homework.no_drafts` | Write at least one question. |  |  |  | field | homework |
| `homework.no_figure` | This question has no figure to read. |  |  |  | field | homework |
| `homework.no_groups` | Pick at least one due date to add. |  |  |  | field | homework |
| `homework.no_homework_found` | Didn't find any homework in it. | The model read it and found no problems to do. | If the homework is there, paste just that part. |  | inline | homework |
| `homework.no_page_for_question` | This question isn't in the book, so it has no page. |  |  |  | field | homework |
| `homework.no_source` | Give a file, a web page's address, or the assignment's text. |  |  |  | field | homework |
| `homework.not_failed` | Only a question that failed can be tried again. | This question isn't in a failed state, so the page is out of date. | Reload the page to see where the question stands. | `reload` | inline | homework |
| `homework.note_too_long` | Keep each note under {max} characters. |  |  |  | field | homework |
| `homework.nothing_to_add` | There's nothing left to add or change in those. |  |  |  | field | homework |
| `homework.page_empty` | That page has no text to read. |  |  |  | field | homework |
| `homework.page_outside` | The book doesn't have that page. |  |  |  | field | homework |
| `homework.page_refused` | That page answered {status}. A page behind a login can be pasted or photographed instead. |  |  |  | field | homework |
| `homework.page_unreachable` | Couldn't reach that page. |  |  |  | field | homework |
| `homework.page_unreadable` | Couldn't read that page. |  |  |  | field | homework |
| `homework.pdf_unreadable` | That PDF couldn't be read. |  |  |  | field | homework |
| `homework.question_not_found` | That question isn't there. | It was removed, or the page is out of date. | Go back to the set's list of questions. |  | inline | homework |
| `homework.read_busy` | That assignment is already read, or being read. | It isn't in a failed state, so there is nothing to try again. | Reload the page to see where it stands. | `reload` | inline | homework |
| `homework.read_failed` | Couldn't read the assignment. | Something went wrong while PSet was reading it. | Try again, or paste just the part with the problems. | `retry` | inline | homework |
| `homework.reading_empty` | Write at least one line. |  |  |  | field | homework |
| `homework.reading_line_too_long` | Keep each line under {max} characters. |  |  |  | field | homework |
| `homework.reading_too_long` | Keep it to {max} lines. |  |  |  | field | homework |
| `homework.reply_unreadable` | Couldn't make out the assignment's homework. | The model's answer wasn't in a form PSet could read. | Try again, or paste just the part with the problems. | `retry` | inline | homework |
| `homework.set_not_found` | That homework set isn't there. | It was removed, or the page is out of date. | Go back to the book's homework list. |  | inline | homework |
| `homework.text_too_long` | That's too long for a single question. |  |  |  | field | homework |
| `homework.title_empty` | Give it a title. |  |  |  | field | homework |
| `homework.title_too_long` | Keep the title under {max} characters. |  |  |  | field | homework |
| `homework.too_many_boxes` | That's more than {max} boxes for one problem. |  |  |  | field | homework |
| `homework.too_many_drafts` | That's more than {max} questions at once. Add them in smaller batches. |  |  |  | field | homework |
| `homework.too_many_lines` | That's more than {max} lines at once. |  |  |  | field | homework |
| `homework.too_many_notes` | Keep it to {max} notes. |  |  |  | field | homework |
| `import.cancelled` | {title} was cancelled before it started. | You stopped it before PSet began. | Try again to start it. | `retry` | inline | library |
| `import.contents_render` | PSet couldn't render the book's contents pages. | The pages couldn't be turned into pictures for the model. | Try again. | `retry` | inline | library |
| `import.contents_stalled` | The model stopped answering while PSet read the book's contents. | OpenRouter took too long to answer. | Try again in a minute. | `retry` | inline | library |
| `import.contents_unreadable` | The model's answer about the book's contents couldn't be read. | It wasn't in a form PSet could use. | Try again. | `retry` | inline | library |
| `import.failed` | Couldn't prepare {title}. | Something went wrong while PSet was preparing it. | Try again. | `retry` | inline | library |
| `import.pages_unread` | Some pages couldn't be read. | PSet's text reader, Tesseract, failed on {count} ({list}). | Try again, or check that Tesseract works in Settings. | `retry` | inline | library |
| `import.pdf_empty` | This PDF has no pages. | The file opened but holds nothing to read. | Try a different copy of the file. |  | inline | library |
| `import.pdf_unreadable` | This PDF can't be read. | PSet couldn't open it, so it may be damaged or locked. | Try a different copy of the file. |  | inline | library |
| `import.stopped` | {title} was stopped. | You stopped it before it finished. | Try again to carry on where it left off. | `retry` | inline | library |
| `import.structure_unreadable` | PSet couldn't read this book's structure. | The PDF's outline couldn't be extracted. | Try again. If it keeps happening, the file may be damaged. | `retry` | inline | library |
| `internal.unexpected` | Something went wrong inside PSet. | PSet hit a problem it has no name for. | Try again. If it keeps happening, copy the details and report it. | `retry` | inline | errs |
| `key.missing` | There's no OpenRouter key yet. | PSet needs a key to read pages and write answers. | Add your key in Settings, under Connections. | `open_settings` | inline | llm |
| `key.out_of_credit` | Your OpenRouter account is out of credit. | Your OpenRouter account is out of credit, so PSet can't use a model. | Add credit on OpenRouter, then try again. | `retry` | inline | llm |
| `key.refused` | OpenRouter refused the key. | The key in Settings may be wrong, expired or deleted. | Check the key in Settings, then try again. | `open_settings` | inline | llm |
| `library.bad_cover` | That isn't one of the cover colours. |  |  |  | field | library |
| `library.bad_problem_form` | That isn't a way of numbering problems. |  |  |  | field | library |
| `library.bad_problem_where` | Problems sit after each section or at each chapter's end. |  |  |  | field | library |
| `library.no_ollama` | PSet can't reach Ollama. | Ollama searches your books, and it isn't answering. | Settings, under Health, says how to start it. | `open_settings` | inline | library |
| `library.not_failed` | Only a book that failed to import can be tried again. | This book isn't in a failed state, so the page is out of date. | Reload the page to see where the book stands. | `reload` | inline | library |
| `library.not_pdf` | That isn't a PDF. |  |  |  | field | library |
| `library.page_not_found` | That page isn't in this book. | The page number is past the end of the book, or isn't a number. | Go to a page inside the book. |  | inline | library |
| `library.run_bad_offset` | PDF page {from} can't be printed as page {printed}. |  |  |  | field | library |
| `library.run_outside` | Each PDF page has to be inside the book: 1 to {max}. |  |  |  | field | library |
| `library.runs_empty` | Say where printed page 1 is. |  |  |  | field | library |
| `library.title_empty` | A book needs a title. |  |  |  | field | library |
| `memory.empty` | Write what to remember. |  |  |  | field | memory |
| `memory.not_found` | That memory isn't there. | It was already forgotten, or the list is out of date. | Reload the page to see what is remembered now. | `reload` | inline | memory |
| `memory.too_long` | Keep it to a sentence or two ({max} characters at most). |  |  |  | field | memory |
| `model.busy` | OpenRouter didn't answer properly. | OpenRouter is busy or having trouble right now. | Try again in a minute. | `retry` | inline | llm |
| `model.cut` | The model's answer stopped partway. | The connection to the model dropped while it was writing. | Trying again usually works. | `retry` | inline | llm |
| `model.rejected` | OpenRouter turned the request down. | OpenRouter refused it for a reason PSet has no name for. | Try again. If it keeps happening, copy the details and report it. | `retry` | inline | llm |
| `model.unknown` | OpenRouter doesn't know a model PSet uses. | A model PSet relies on was renamed or removed. | Check for a PSet update. | `check_update` | inline | llm |
| `model.unreachable` | PSet couldn't reach OpenRouter. | The internet connection is down, or OpenRouter didn't answer in time. | Check the internet connection, then try again. | `retry` | inline | llm |
| `request.foreign_origin` | PSet refused that change. | PSet takes changes only from its own page. | Make the change from PSet's own page. |  | inline | errs |
| `request.invalid_json` | PSet couldn't read what was sent. | The page and PSet's server are out of step, which happens after an update. | Reload the page and try again. | `reload` | inline | errs |
| `request.no_file` | No file came with the upload. |  |  |  | field | httpx |
| `request.not_found` | PSet's server doesn't have what the page asked for. | The page and the server are out of step, which happens after an update. | Reload the page. | `reload` | inline | errs |
| `request.not_local` | PSet refused that request. | PSet answers only requests addressed to this computer, as localhost. | Open PSet at http://localhost and try again. |  | inline | errs |
| `request.not_multipart` | Send the file as a multipart upload. |  |  |  | field | httpx |
| `request.too_large` | That's too much to send in one request. | A single request is limited to {limit} MB. | Send it in smaller pieces. |  | inline | errs |
| `request.unreachable` | PSet can't reach its server. | The server may have stopped, or the computer went to sleep. | Start PSet again, then try again. | `retry` | screen | errs |
| `request.upload_cut` | The upload was cut off. |  |  |  | field | httpx |
| `settings.check_not_found` | PSet has no such check. | The page and PSet are out of step, which happens after an update. | Reload the page. | `reload` | inline | settings |
| `settings.fix_data_dir` | Couldn't create the data folder. | PSet isn't allowed to create it there, or the disk is full. | Create the folder yourself, or free up space, then check again. |  | inline | settings |
| `settings.fix_database` | Couldn't update the database. | The database can't be brought up to date, which means it is damaged or comes from a newer PSet. | Update PSet. If that doesn't help, reset PSet from this page. |  | inline | settings |
| `settings.fix_ollama` | Ollama couldn't download {model}. | Ollama isn't running, or the download was cut off. | Start Ollama and check the internet connection, then try again. | `retry` | inline | settings |
| `settings.key_empty` | Paste your OpenRouter key first. |  |  |  | field | settings |
| `settings.name_too_long` | Keep it under {max} characters. |  |  |  | field | settings |
| `settings.not_fixable` | PSet can't fix this one itself. | Fixing it needs something installed or changed outside PSet. | Follow the steps listed with the check, then check again. |  | inline | settings |
| `settings.test_failed` | Couldn't connect with that key. | PSet couldn't finish the test. | Try again in a minute. | `retry` | inline | settings |
| `update.already_installing` | An update is already being installed. | Another request started it a moment ago. | Wait for PSet to restart. |  | inline | update |
| `update.bad_tag` | Couldn't look for an update. | The latest release is tagged {tag}, which isn't a version number. | Try again later. If it keeps happening, copy the details and report it. |  | inline | update |
| `update.check_unreachable` | Couldn't look for an update. | PSet couldn't reach GitHub. | Check the internet connection, then try again. | `retry` | inline | update |
| `update.download_failed` | The update wasn't installed. | The download failed or broke off. Nothing was changed. | Check the internet connection, then try again. | `retry` | inline | update |
| `update.github_error` | Couldn't look for an update. | GitHub answered with an error (HTTP {status}). | Try again in a minute. | `retry` | inline | update |
| `update.no_program_file` | PSet can't update itself here. | PSet can't find its own program file. | Run the installer again. |  | inline | update |
| `update.no_release` | There is no published release yet. | No version of PSet has been published to update to. |  |  | inline | update |
| `update.no_release_key` | PSet can't update itself here. | This build has no release key, so it can't tell a real update from a fake one. | Install an official release. |  | inline | update |
| `update.not_for_this_computer` | The update wasn't installed. | This release has no build that runs on this computer. Nothing was changed. | Check the releases page for a build that does. |  | inline | update |
| `update.not_trusted` | The update wasn't installed. | PSet couldn't verify the download, so it threw it away. Nothing was changed. | Try again later. If it keeps happening, copy the details and report it. |  | inline | update |
| `update.not_writable` | PSet can't update itself here. | PSet can't write to {dir}, where it is installed, so it can't replace itself. | Run the installer again instead. |  | inline | update |
| `update.nothing_to_install` | There is no newer version to install. | PSet hasn't found one yet. | Check for updates first. |  | inline | update |
| `update.replace_failed` | The update wasn't installed. | PSet couldn't put the new program in place. Nothing was changed. | Make sure PSet's folder can be written to, or run the installer again. |  | inline | update |
| `update.source_build` | PSet can't update itself here. | This is a build from source. | Update it by pulling and rebuilding. |  | inline | update |
| `update.unreadable_release` | Couldn't look for an update. | GitHub's answer wasn't in a shape PSet can read. | Try again later. If it keeps happening, copy the details and report it. | `retry` | inline | update |
| `update.unsupported_system` | PSet can't update itself here. | Updating itself isn't supported on this system. | Run the installer for the new version instead. |  | inline | update |
