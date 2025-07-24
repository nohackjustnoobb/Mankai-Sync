# Mankai Sync

Mankai Sync is a sync server for the Mankai app, providing both a backend API and an admin web page for user management. Administrators can easily manage users through the admin page. The recommended way to run the app is with Docker Compose.

## Getting Started

### Prerequisites

- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### Running with Docker Compose

> **Important:**
>
> For security, edit the `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` values in your `docker-compose.yml` file before deploying or running in production.

1. Build and start all services:

   ```
   sudo docker-compose up -d
   ```

2. Once started, the admin page will be available at [http://localhost:3000](http://localhost:3000), and the backend API at [http://localhost:3000/api](http://localhost:3000/api).

3. To stop the services:
   ```
   sudo docker-compose down
   ```
