# Build-time-only configuration. Keep base images and the package manager version pinned.
FROM public.ecr.aws/docker/library/node:24.14.0-alpine3.22@sha256:76db75ca7e7da9148ae42c92d9be12d12a8d7b03e171f18339355d8078d644a0 AS build

ARG PNPM_VERSION=9.15.9
ARG VITE_API_URL=/v1
ARG VITE_WORKS_API_URL=/v2
ARG VITE_WORKS_V2=true
ARG VITE_BACKEND_URL=https://test-forum.shimmerday.top
ARG VITE_USE_MOCK=false
ARG VITE_API_MOCKING=false
ARG VITE_SHOW_DEVTOOLS=false

ENV VITE_API_URL=${VITE_API_URL} \
    VITE_WORKS_API_URL=${VITE_WORKS_API_URL} \
    VITE_WORKS_V2=${VITE_WORKS_V2} \
    VITE_BACKEND_URL=${VITE_BACKEND_URL} \
    VITE_USE_MOCK=${VITE_USE_MOCK} \
    VITE_API_MOCKING=${VITE_API_MOCKING} \
    VITE_SHOW_DEVTOOLS=${VITE_SHOW_DEVTOOLS}

WORKDIR /app
RUN npm install --global pnpm@${PNPM_VERSION}

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm exec tsc -b && pnpm exec vite build --mode test

FROM public.ecr.aws/docker/library/nginx:1.29.3-alpine@sha256:b3c656d55d7ad751196f21b7fd2e8d4da9cb430e32f646adcf92441b72f82b14 AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html

# Static files are readable by the unprivileged nginx user. All writable state is tmpfs.
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
