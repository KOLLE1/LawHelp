// Jenkinsfile: Automated Docker Build and Portainer Deployment via Webhook

// Define the overall pipeline
pipeline {
    // Agent: Specifies where the pipeline will run.
    // 'any' means Jenkins will pick any available agent.
    // For Docker builds, ensure your Jenkins agent has Docker installed and configured.
    agent any

    // Parameters:
    // It's a good practice to define key variables as parameters so they can be
    // easily configured when triggering the job, rather than hardcoding them.
    parameters {
        string(name: 'GIT_REPO_URL', defaultValue: 'https://github.com/KOLLE1/LawHelp', description: 'URL of the Git repository to clone')
        string(name: 'GIT_BRANCH', defaultValue: 'main', description: 'Branch to checkout from the Git repository')
        string(name: 'DOCKER_IMAGE_NAME', defaultValue: 'lawhelp:latest', description: 'Name and tag for the Docker image (e.g., myapp:1.0)')
        string(name: 'PORTAINER_WEBHOOK_URL', defaultValue: 'https://46.202.195.91:9443/api/stacks/webhooks/f681093f-b55a-4520-817e-fd6add9064e8', description: 'Portainer webhook URL to trigger deployment (e.g., https://portainer.example.com/api/webhooks/ABCDEF123456)')
        // If your repository is private, you would typically use a 'credentials' parameter
        // credentials(name: 'GIT_CREDENTIALS_ID', description: 'Jenkins credential ID for Git access', required: false)
    }

    // Environment variables:
    // Define variables that will be available throughout the pipeline.
    // These use the parameters defined above.
    // Stages: Define the different steps in your CI/CD process.
    stages {
        // Stage 1: Checkout the Git Repository
        stage('Checkout Source Code') {
            steps {
                script {
                    echo "Checking out Git repository: ${params.GIT_REPO_URL} branch: ${params.GIT_BRANCH}"
                    // Use the 'git' step to clone the repository.
                    // For private repos, add: credentialsId: params.GIT_CREDENTIALS_ID
                    git branch: params.GIT_BRANCH, url: params.GIT_REPO_URL
                }
            }
        }

        // Stage 2: Build the Docker Image
        stage('Build Docker Image') {
            steps {
                script {
                    echo "Building Docker image: ${params.DOCKER_IMAGE_NAME}"
                    // Execute a shell command to build the Docker image.
                    // The '.' specifies that the Dockerfile is in the current directory.
                    sh "docker build -t ${params.DOCKER_IMAGE_NAME} ."
                    echo "Docker image built successfully: ${params.DOCKER_IMAGE_NAME}"

                    // OPTIONAL: Push the Docker image to a registry (e.g., Docker Hub, GCR, ECR)
                    // If Portainer is pulling from a private registry, you'll need to push the image.
                    // If Portainer is pulling directly from the Jenkins agent's local Docker daemon,
                    // or from a public registry, this step might be optional or different.
                    // Replace 'your-registry-url' with your actual registry.
                    /*
                    echo "Pushing Docker image to registry..."
                    withDockerRegistry(credentialsId: 'your-docker-registry-credential-id', url: 'your-registry-url') {
                        sh "docker push ${params.DOCKER_IMAGE_NAME}"
                    }
                    echo "Docker image pushed successfully."
                    */
                }
            }
        }

        // Stage 3: Send Webhook to Portainer for Deployment
        // This stage will only execute if the previous stages (especially build) are successful.
        stage('Trigger Portainer Deployment') {
            steps {
                script {
                    echo "Attempting to trigger Portainer deployment via webhook: ${params.PORTAINER_WEBHOOK_URL}"
                    // Use 'curl' to send a POST request to the Portainer webhook URL.
                    // Portainer webhooks typically expect a simple POST request.
                    def response = sh(script: "curl -s -o /dev/null -w '%{http_code}' -X POST ${params.PORTAINER_WEBHOOK_URL}", returnStdout: true).trim()

                    if (response == '200' || response == '204') { // Portainer might return 200 OK or 204 No Content
                        echo "Portainer webhook sent successfully! HTTP Status: ${response}"
                    } else {
                        error "Failed to send Portainer webhook. HTTP Status: ${response}"
                    }
                }
            }
        }
    }

    // Post-build actions: These actions run after all stages are completed, regardless of success or failure.
    post {
        always {
            echo 'Pipeline job finished.'
        }
        success {
            echo 'All stages completed successfully. Application should be deploying via Portainer.'
        }
        failure {
            echo 'One or more stages failed. Portainer deployment webhook was NOT sent.'
            // You could add notifications here (e.g., email, Slack)
            // mail to: 'your-email@example.com', subject: "Jenkins Build Failed: ${env.JOB_NAME}", body: "Build ${env.BUILD_NUMBER} for ${env.JOB_NAME} failed. Check ${env.BUILD_URL}"
        }
        unstable {
            echo 'Pipeline finished with unstable status (e.g., test failures).'
        }
        aborted {
            echo 'Pipeline was aborted.'
        }
    }
}