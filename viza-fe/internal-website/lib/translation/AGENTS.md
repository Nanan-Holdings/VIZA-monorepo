# Translation Library Agent Guide

Scope: this file applies to `viza-fe/internal-website/lib/translation/**`.

Keep translation provider keys server-only. Browser components must call a
trusted route or server action instead of reading provider credentials directly.
Return typed provider results and avoid logging applicant-entered text.
