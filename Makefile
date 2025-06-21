lint:
	npx prettier --write .

auth: 
	node --no-warnings getRefreshToken.ts

test-direct:
	npx tsx tests/gmail-unread.ts
