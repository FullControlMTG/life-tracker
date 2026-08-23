pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    SERVICE_NAME   = 'life-tracker'
    DB_SERVICE     = 'life-tracker-db'
    INTERNAL_PORT  = '8080'
    TRAEFIK_NETWORK = 'traefik'

    // The public host Traefik routes to this service.
    APP_DOMAIN = 'tracker.fullcontrolmtg.com'

    // Build-time config baked into the frontend bundle.
    VITE_API_BASE = '/api/v1'

    POSTGRES_PASSWORD = credentials('life-tracker-postgres-password')
    DISCORD_WEBHOOK   = credentials('discord-pws-builds-channel-webhook')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        script {
          env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
        }
        echo "Building ${env.SERVICE_NAME} @ ${env.GIT_SHA}"
      }
    }

    stage('Preflight') {
      steps {
        sh '''
          set -eu

          for var in POSTGRES_PASSWORD DISCORD_WEBHOOK APP_DOMAIN; do
            eval "value=\\${$var:-}"
            if [ -z "$value" ]; then
              echo "PREFLIGHT FAILED: required value $var is empty. Check the Jenkins credential binding." >&2
              exit 1
            fi
          done

          command -v docker >/dev/null 2>&1 || { echo "PREFLIGHT FAILED: docker is not on PATH." >&2; exit 1; }
          docker compose version >/dev/null 2>&1 || { echo "PREFLIGHT FAILED: docker compose v2 is unavailable." >&2; exit 1; }

          # Traefik owns this network; the deploy cannot attach if it is missing.
          docker network inspect "$TRAEFIK_NETWORK" >/dev/null 2>&1 || {
            echo "PREFLIGHT FAILED: external docker network '$TRAEFIK_NETWORK' does not exist." >&2; exit 1; }

          for f in Dockerfile docker-compose.yml; do
            [ -f "$f" ] || { echo "PREFLIGHT FAILED: $f is missing from the repository root." >&2; exit 1; }
          done

          docker compose config -q || { echo "PREFLIGHT FAILED: docker-compose.yml did not validate." >&2; exit 1; }

          echo "Preflight OK."
        '''
      }
    }

    stage('Lint & Type-check') {
      parallel {
        stage('Backend') {
          steps {
            sh '''
              set -eu
              docker build --target api-check -t "${SERVICE_NAME}-api-check:${BUILD_NUMBER}" . \
                || { echo "BACKEND CHECKS FAILED: go vet or go test reported errors." >&2; exit 1; }
            '''
          }
        }
        stage('Frontend') {
          steps {
            sh '''
              set -eu
              docker build --target web-check -t "${SERVICE_NAME}-web-check:${BUILD_NUMBER}" . \
                || { echo "FRONTEND CHECKS FAILED: lint, type-check or unit tests reported errors." >&2; exit 1; }
            '''
          }
        }
      }
      post {
        always {
          sh '''
            set +e
            docker rmi "${SERVICE_NAME}-api-check:${BUILD_NUMBER}" "${SERVICE_NAME}-web-check:${BUILD_NUMBER}" >/dev/null 2>&1
            exit 0
          '''
        }
      }
    }

    stage('Teardown') {
      steps {
        sh '''
          set -eu
          # No -v: the database volume must survive a redeploy.
          docker compose down --remove-orphans --timeout 30 || true

          for c in "$SERVICE_NAME" "$DB_SERVICE"; do
            if [ -n "$(docker ps -aq -f "name=^${c}$")" ]; then
              echo "Removing leftover container $c."
              docker rm -f "$c" >/dev/null
            fi
          done

          echo "Teardown OK."
        '''
      }
    }

    stage('Build & Deploy') {
      steps {
        sh '''
          set -eu
          docker compose build --pull \
            || { echo "BUILD FAILED: image build did not complete." >&2; exit 1; }
          docker compose up -d \
            || { echo "DEPLOY FAILED: docker compose up did not start the stack." >&2; exit 1; }
          echo "Deployed $SERVICE_NAME @ $GIT_SHA."
        '''
      }
    }

    stage('Health Check') {
      steps {
        sh '''
          set -eu
          deadline=$(( $(date +%s) + 180 ))

          while :; do
            state=$(docker inspect -f '{{.State.Status}}' "$SERVICE_NAME" 2>/dev/null || echo missing)
            health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$SERVICE_NAME" 2>/dev/null || echo none)

            if [ "$state" = running ] && [ "$health" = healthy ]; then
              echo "Container is healthy."
              break
            fi

            case "$state" in
              exited|dead)
                echo "HEALTH CHECK FAILED: container $SERVICE_NAME exited before becoming healthy." >&2
                docker logs --tail 100 "$SERVICE_NAME" >&2 || true
                exit 1 ;;
              missing)
                echo "HEALTH CHECK FAILED: container $SERVICE_NAME does not exist." >&2
                exit 1 ;;
            esac

            if [ "$(date +%s)" -ge "$deadline" ]; then
              echo "HEALTH CHECK FAILED: $SERVICE_NAME never reported healthy within 180s (state=$state health=$health)." >&2
              docker logs --tail 100 "$SERVICE_NAME" >&2 || true
              exit 1
            fi
            sleep 3
          done
        '''
      }
    }

    stage('Smoke Test') {
      steps {
        sh '''
          set -eu

          body=$(docker exec "$SERVICE_NAME" wget -qO- "http://127.0.0.1:${INTERNAL_PORT}/healthz") \
            || { echo "SMOKE TEST FAILED: /healthz did not respond inside the container." >&2; exit 1; }
          echo "$body" | grep -q '"status":"ok"' \
            || { echo "SMOKE TEST FAILED: /healthz returned unexpected body: $body" >&2; exit 1; }

          index=$(docker exec "$SERVICE_NAME" wget -qO- "http://127.0.0.1:${INTERNAL_PORT}/") \
            || { echo "SMOKE TEST FAILED: the SPA did not respond at /." >&2; exit 1; }
          echo "$index" | grep -q 'id="root"' \
            || { echo "SMOKE TEST FAILED: / did not return the SPA shell." >&2; exit 1; }

          # Confirms Traefik actually routes the public domain to this container.
          public=$(curl -fsS --max-time 15 --retry 5 --retry-delay 3 --retry-connrefused \
            "https://${APP_DOMAIN}/healthz") \
            || { echo "SMOKE TEST FAILED: https://${APP_DOMAIN}/healthz was not reachable through Traefik." >&2; exit 1; }
          echo "$public" | grep -q '"status":"ok"' \
            || { echo "SMOKE TEST FAILED: public /healthz returned unexpected body: $public" >&2; exit 1; }

          echo "Smoke tests passed against https://${APP_DOMAIN}."
        '''
      }
    }
  }

  post {
    always {
      script {
        def emoji = ['SUCCESS': ':green_circle:', 'FAILURE': ':red_circle:']
          .get(currentBuild.currentResult, ':yellow_circle:')

        def branch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: 'Main/Manual'

        def duration = currentBuild.durationString
          .replace(' and no weeks', '')
          .replace(' and counting', '')

        def commits = currentBuild.changeSets.collectMany { set ->
          set.items.collect { "> ${it.msg} (by *${it.author.displayName}*)" }
        }
        def commitText = commits ? commits.join('\n') : 'No recent changes detected.'

        def discordDescription = """**Status:** ${emoji} ${currentBuild.currentResult}
**Branch:** `${branch}`
**Duration:** :stopwatch: ${duration}

**Commits:**
${commitText}"""

        discordSend(
          webhookURL: env.DISCORD_WEBHOOK,
          title: "📦 Build Alert: ${env.JOB_NAME} [Build #${env.BUILD_NUMBER}]",
          link: "${env.BUILD_URL}",
          result: "${currentBuild.currentResult}",
          description: discordDescription
        )
      }
    }

    failure {
      sh '''
        set +e
        echo "===== compose ps ====="
        docker compose ps
        echo "===== ${SERVICE_NAME} logs (last 200) ====="
        docker logs --tail 200 "$SERVICE_NAME"
        echo "===== ${DB_SERVICE} logs (last 100) ====="
        docker logs --tail 100 "$DB_SERVICE"
        echo "===== container state ====="
        docker inspect -f 'status={{.State.Status}} exit={{.State.ExitCode}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$SERVICE_NAME"
      '''
    }
  }
}
