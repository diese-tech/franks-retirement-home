# Admin mutation surface allows post-publish participant edits and reseeding

Status: accepted

The Tournament admin API exposes: create (name + ordered participants, including "BYE" slots), edit participant names, reseed a slot, record a match winner (advances the bracket), publish (draft→live), and reset/delete. Unlike the narrower option considered, editing and reseeding participants is allowed after publish, not just during setup — an admin can fix a typo or swap a participant while the Tournament is `live`.

The constraint that keeps this safe: a slot can only be edited or reseeded if the `Bracket Match` it feeds into hasn't recorded a winner yet. Once a match has a result, its participants are locked — changing them would retroactively rewrite history for a bracket that's already been watched updating live. This mirrors the existing Draft admin surface's philosophy (e.g. `reopenLastPick`): admins can correct mistakes, but only by walking backward through actions that haven't cascaded into dependent state yet, not by silently mutating settled results.
