# Google Sheets Template

Create a new Google Sheet with these exact column headers in row 1:

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| date | email | score | timeLeft | revealsLetter | revealsWord | userAgent | timestamp |

## Sample Data

After users start submitting scores, your sheet will look like this:

| date | email | score | timeLeft | revealsLetter | revealsWord | userAgent | timestamp |
|------|-------|-------|----------|---------------|-------------|-----------|-----------|
| 2025-10-13 | user@example.com | 52 | 32 | 0 | 1 | Mozilla/5.0... | 2025-10-13 09:30:00 |
| 2025-10-13 | player2@gmail.com | 60 | 60 | 0 | 0 | Mozilla/5.0... | 2025-10-13 10:15:00 |
| 2025-10-14 | user@example.com | 45 | 25 | 1 | 0 | Mozilla/5.0... | 2025-10-14 08:45:00 |

## Notes

- Each user gets one entry per date (best score wins)
- Score = timeLeft - (2 × revealsLetter) - (10 × revealsWord)
- Perfect scores have 0 reveals
- DNF (Did Not Finish) entries are not submitted