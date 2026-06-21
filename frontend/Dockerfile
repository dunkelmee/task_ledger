FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Store as a template; BACKEND_URL is substituted at container start
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 80
# envsubst replaces only ${BACKEND_URL} (other nginx $vars are left untouched)
CMD ["/bin/sh", "-c", "envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
