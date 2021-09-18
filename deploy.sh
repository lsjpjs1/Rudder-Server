# cd /home/rudder-docker

# sudo docker rm rudder-server -f
# sudo docker build -t rudder-server -f Dockerfile .
# sudo docker run --name rudder-server --env-file ./env.list -p 3001:3000 rudder-server