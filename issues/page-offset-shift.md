# One page offset can't fit every book

A book has a single printed-page offset (`books.page_offset`), but a scan
can drop or duplicate a page, and then the offset changes partway through.

Seen in *Elementary Differential Equations* (Boyce, DiPrima & Meade), a
scan: printed = PDF − 12 for PDF 13 to 96, then PDF − 11 from PDF 98 on.
A printed page (85 or 86) is missing around PDF 97. The stored offset is
11, so in Chapters 1 to 2.7 printed numbers, citations and "p. 23" jumps
land one page early.

Options when we take it up: offsets per page range (derived from the
contents entries, which get matched to the scan anyway), or detecting it
and warning.
