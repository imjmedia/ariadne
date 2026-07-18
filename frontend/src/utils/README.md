# Chat history payload

Utilities for chat memory compaction and safe `history` bodies on `POST …/chat`.

- **`compactChatMessagesInMemory`** — caps in-memory thread (24 messages), strips `result`, truncates older assistant/user text.
- **`buildChatHistoryForRequest`** — last 6 turns for the API, per-field truncation.
- **`formatMemoryCompactionNote`** — short UI hint when compaction ran.

Used by chat pages via icono «Nueva conversación» en cabecera + nota en popover Opciones (`ChatPageHeader`).
