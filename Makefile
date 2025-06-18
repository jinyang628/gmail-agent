lint:
	npx prettier --write .

auth: 
	node --no-warnings getRefreshToken.ts
