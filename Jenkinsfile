
pipeline {
    agent any
    
    environment {
        NODE_VERSION = '20'
        DOCKER_IMAGE = 'legal-navigator'
        DOCKER_TAG = "${BUILD_NUMBER}"
        REGISTRY = 'ghrc.io'
    }
    
    stages {
        stage('Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('Setup Environment') {
            steps {
                script {
                    // Install Node.js
                    sh '''
                        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
                        export NVM_DIR="$HOME/.nvm"
                        [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                        nvm install ${NODE_VERSION}
                        nvm use ${NODE_VERSION}
                    '''
                }
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    npm ci
                '''
            }
        }
        
        stage('Code Quality & Linting') {
            parallel {
                stage('TypeScript Check') {
                    steps {
                        sh '''
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            npm run check
                        '''
                    }
                }
                stage('Lint') {
                    steps {
                        sh '''
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            npx eslint . --ext .ts,.tsx --max-warnings 0
                        '''
                    }
                }
            }
        }
        
        stage('Run Tests') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh '''
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            npm run test:unit
                        '''
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results/unit/*.xml'
                        }
                    }
                }
                stage('Integration Tests') {
                    steps {
                        sh '''
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            npm run test:integration
                        '''
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results/integration/*.xml'
                        }
                    }
                }
                stage('E2E Tests') {
                    steps {
                        sh '''
                            export NVM_DIR="$HOME/.nvm"
                            [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                            nvm use ${NODE_VERSION}
                            npm run test:e2e
                        '''
                    }
                    post {
                        always {
                            publishTestResults testResultsPattern: 'test-results/e2e/*.xml'
                        }
                    }
                }
            }
        }
        
        stage('Code Coverage') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    npm run test:coverage
                '''
            }
            post {
                always {
                    publishCoverage adapters: [
                        istanbulCoberturaAdapter('coverage/cobertura-coverage.xml')
                    ], sourceFileResolver: sourceFiles('STORE_LAST_BUILD')
                }
            }
        }
        
        stage('Security Scan') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    npm audit --audit-level moderate
                    npx snyk test --severity-threshold=medium
                '''
            }
        }
        
        stage('Build Application') {
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    npm run build
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'dist/**/*', fingerprint: true
                }
            }
        }
        
        stage('Build Docker Image') {
            steps {
                script {
                    docker.build("${DOCKER_IMAGE}:${DOCKER_TAG}")
                    docker.build("${DOCKER_IMAGE}:latest")
                }
            }
        }
        
        stage('Deploy to Staging') {
            when {
                branch 'develop'
            }
            steps {
                script {
                    // Deploy to staging environment
                    sh '''
                        kubectl config use-context staging
                        kubectl set image deployment/legal-navigator legal-navigator=${DOCKER_IMAGE}:${DOCKER_TAG}
                        kubectl rollout status deployment/legal-navigator
                    '''
                }
            }
        }
        
        stage('Deploy to Production') {
            when {
                branch 'main'
            }
            steps {
                script {
                    input message: 'Deploy to production?', ok: 'Deploy'
                    sh '''
                        kubectl config use-context production
                        kubectl set image deployment/legal-navigator legal-navigator=${DOCKER_IMAGE}:${DOCKER_TAG}
                        kubectl rollout status deployment/legal-navigator
                    '''
                }
            }
        }
        
        stage('Post-Deployment Tests') {
            when {
                anyOf {
                    branch 'main'
                    branch 'develop'
                }
            }
            steps {
                sh '''
                    export NVM_DIR="$HOME/.nvm"
                    [ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"
                    nvm use ${NODE_VERSION}
                    npm run test:smoke
                '''
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            slackSend(
                channel: '#deployments',
                color: 'good',
                message: "✅ Pipeline succeeded for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
        failure {
            slackSend(
                channel: '#deployments',
                color: 'danger',
                message: "❌ Pipeline failed for ${env.JOB_NAME} - ${env.BUILD_NUMBER}"
            )
        }
    }
}