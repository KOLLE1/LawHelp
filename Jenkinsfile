pipeline {
    agent any
    environment {
        // Define the GitHub Packages registry and credentials
        REGISTRY = "ghcr.io"
        IMAGE_NAME = "${env.GITHUB_REPOSITORY_OWNER}/${env.REPOSITORY_NAME}"
    }
    stages {
        stage('Checkout') {
            steps {
                // Clone the GitHub repository
                git url: "https://github.com/KOLLE1/LawHelp", branch: 'main'
            }
        }
        stage('Build Docker Image') {
            steps {
                script {
                    // Build the Docker image with the build number as the tag
                    dockerImage = docker.build("${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER}")
                }
            }
        }
        stage('Push to GitHub Packages') {
            steps {
                script {
                    // Log in to GitHub Packages and push the image
                    docker.withRegistry("https://${REGISTRY}", 'github-packages-credentials') {
                        dockerImage.push()
                        dockerImage.push('latest')
                    }
                }
            }
        }
        stage('Clean Up') {
            steps {
                // Remove the local Docker image to save space
                sh "docker rmi ${REGISTRY}/${IMAGE_NAME}:${env.BUILD_NUMBER} || true"
                sh "docker rmi ${REGISTRY}/${IMAGE_NAME}:latest || true"
            }
        }
    }
    post {
        always {
            // Log out from GitHub Packages
            sh 'docker logout'
        }
        success {
            echo 'Docker image successfully built and pushed to GitHub Packages!'
        }
        failure {
            echo 'Build or push failed. Check the logs for details.'
        }
    }
}