<?php

// 表格请求的参数
$page = isset($_GET['page']) ? $_GET['page'] : '';          // 分页的页数
$rows = isset($_GET['rows']) ? $_GET['rows'] : '';          // 分页每页的行数
$orderby = isset($_GET['orderby']) ? $_GET['orderby'] : ''; // 排序字段key
$sort = isset($_GET['sort']) ? $_GET['sort'] : '';          // 排序字段的排序方式   ASC or DESC

// 表格数据协议
$data = array(
    'count' => 88,   // 所有数据的总行数
    'list' => array(
        array( 'name' => '西门吹雪', 'age' => 18, 'sex' => '男', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '公孙大娘', 'age' => 28, 'sex' => '女', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '李寻欢', 'age' => 38, 'sex' => '女', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '楚留香', 'age' => 27, 'sex' => '未知', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '陆小凤', 'age' => 39, 'sex' => '女', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '叶开', 'age' => 41, 'sex' => '未知', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '傅红雪', 'age' => 66, 'sex' => '女', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '萧别离', 'age' => 50, 'sex' => '男', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '铁中棠', 'age' => 29, 'sex' => '男', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn'),
        array( 'name' => '萧十一郎', 'age' => 33, 'sex' => '男', 'birthday' => '8月1日', 'phone' => '13500000000', 'email' => 'x-crm@motouch.cn')
    )
);

// 排序
if ( !empty($orderby) && !empty($sort)) {
    array_multisort( array_column( $data['list'], $orderby), $sort == 'ASC' ? SORT_ASC : SORT_DESC, $data['list']);
}

// 统一封装
$return = array(
    'result' => 0,// 非零表示错误
    'data' => $data
);

echo json_encode($return);