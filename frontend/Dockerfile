FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Store as a template; BACKEND_URL and PORT are substituted at container start
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 80
# Default PORT to 80 locally (Railway injects its own $PORT), then substitute
# only ${BACKEND_URL} and ${PORT} — other nginx $vars are left untouched.
CMD ["/bin/sh", "-c", "export PORT=\"${PORT:-80}\"; envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
