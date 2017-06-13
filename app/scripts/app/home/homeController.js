'use strict';

angular.module('demoApp')
.controller('HomeCtrl', function ($scope) {
  $scope.todos = [{
  	title: 'to do 1',
  	description: 'todo 1'
  }];

  $scope.todo = {};

  $scope.selectedAllChecked = function(value) {
  	angular.forEach($scope.todos, function(item) {
  		item.checked = value;
  	});
  };

  $scope.selectTodo = function(item) {
  	$scope.selectAll = false;
  };

  $scope.removeSelectedItem = function() {
  	var todos = $scope.todos.filter(function(item) {
  		return !item.checked;
  	});

  	$scope.todos = todos;
  };

  $scope.removeItem = function(index) {
  	$scope.todos.splice(index, 1);
  };

  $scope.addTodo = function(form) {
  	if (form.$valid) {
  		$scope.todos.push(angular.copy($scope.todo));
  		$scope.todo = {};
  	}
  };
});