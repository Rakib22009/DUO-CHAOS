# Firestore Security Specification — TWO TOGETHER (DUO CHAOS)

## 1. Data Invariants
1. **Identity Ownership**: A `users/{userId}` document can only be created, read, or updated by the authenticated user whose `request.auth.uid == userId` and `uid == request.auth.uid`, with `email_verified == true`.
2. **Room Host & Two-Player Cap**: A `rooms/{roomId}` document always has an immutable `hostUid == request.auth.uid` on creation, `roomId` matching `^[A-Z0-9]{6}$`, and at most one `guestUid`.
3. **Terminal State Lock**: Once `roomStatus == "completed"`, no further updates to the room document are permitted.
4. **Match Referential Integrity**: Every `matches/{matchId}` document must reference an existing `rooms/{roomId}` document and cannot be updated or deleted once recorded.
5. **Server Timestamp Enforcement**: `createdAt` and `updatedAt` must always equal `request.time`.

## 2. The "Dirty Dozen" Adversarial Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Profile Write**: Write to `/users/userA` when `request.auth == null`.
2. **UID Spoofing**: Authenticated as `userB`, create `/users/userA` or set `uid: "userA"` inside `/users/userB`.
3. **Ghost Field Injection (Profile)**: Create `/users/userA` with extra field `isAdmin: true`.
4. **Oversized Username Poisoning**: Update `/users/userA` with a 500-character `username`.
5. **Client Timestamp Forgery**: Create `/rooms/ABC123` with a hardcoded string `createdAt` instead of `request.time`.
6. **Private Room Enumeration**: Call `list` on `/rooms` without filtering to `isPublic == true && roomStatus == 'waiting'` (or own rooms).
7. **Third-Player Hijack**: While `rooms/ABC123` already has `guestUid: "userB"`, `userC` attempts to overwrite `guestUid: "userC"`.
8. **Host Impersonation**: `userB` attempts to update `currentCheckpoint` or `roomStatus` on a room hosted by `userA`.
9. **Terminal Room Mutation**: Update `currentCheckpoint` on a room where `roomStatus == "completed"`.
10. **Immutable Field Tampering**: Attempt to change `hostUid` or `createdAt` on an existing room.
11. **Orphan Match Injection**: Create `/matches/m1` referencing a non-existent `roomId: "NOPE99"`.
12. **Unverified Email Write**: Attempt any create/update when `request.auth.token.email_verified == false`.
