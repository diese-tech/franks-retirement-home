# Byes are assigned manually, not auto-generated

Status: accepted

When a Tournament's participant count isn't a power of 2, some first-round slots need a bye. The admin assigns these explicitly — typing "BYE" into a slot like any other Participant — rather than the system auto-padding the bracket and algorithmically choosing which seeds get byes.

This follows directly from ADR-0001: admin manually typing names into slots is the whole point of this tool for now. Auto-seeding logic is exactly the kind of hidden algorithm that fights a manual-first tool, and byes are rare enough (only when the count isn't a power of 2) that no automation is worth the complexity here.
